const { db, request, app, resetDatabase, createUser, createPayment, loginAs, insertProject, lastLog } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { csvCell } = require("../services/donorService");

const monthsAgo = (months) => new Date(Date.now() - months * 30 * 24 * 3600 * 1000);

describe("engagement : CRM donateurs", () => {
    let manager;
    let member;
    let account;

    before(async () => {
        await resetDatabase();
        manager = await createUser({ roles: ["responsable_finance"] });
        member = await createUser({ roles: ["membre"] });
        account = await createUser({ email: "compte@test.hope.org", name: "Claire Compte" });
        await db.query("UPDATE users SET region = 'Littoral' WHERE id = ?", [account.id]);
        const projectId = await insertProject({ title: "École de Kribi" });

        // Donatrice avec compte : 2 dons EUR dont un mensuel actif.
        await createPayment({ user_id: account.id, status: "succeeded", amount: 50, paid_at: monthsAgo(2), project_id: projectId });
        await createPayment({ user_id: account.id, status: "succeeded", amount: 30, frequency: "monthly", subscription_id: "sub_crm", subscription_status: "active", paid_at: monthsAgo(1) });
        // Donateur sans compte, en XAF, grand donateur, inactif.
        await createPayment({ status: "succeeded", amount: 1311914, currency: "xaf", donor_email: "Gros@Test.hope.org", donor_name: "=HYPERLINK(\"x\")", paid_at: monthsAgo(14) });
        // Dons non confirmes : ignores.
        await createPayment({ status: "failed", amount: 999, donor_email: "echec@test.hope.org" });
        // Rembourse partiellement.
        await createPayment({ status: "succeeded", amount: 20, refunded_amount: 5, donor_email: "petit@test.hope.org", donor_name: "Petit Don", paid_at: monthsAgo(3) });
    });

    after(() => db.end());

    it("reserve le CRM a la permission MANAGE_DONORS", async () => {
        assert.equal((await request(app).get("/api/engagement/donors")).status, 401);
        assert.equal((await (await loginAs(member)).get("/api/engagement/donors")).status, 403);
    });

    it("agrege les donateurs (compte sinon email) avec total, devise et recurrence", async () => {
        const http = await loginAs(manager);
        const res = await http.get("/api/engagement/donors");
        assert.equal(res.status, 200);
        assert.equal(res.body.total, 3);
        const byKey = Object.fromEntries(res.body.items.map((d) => [d.donor_key, d]));
        const claire = byKey[`u:${account.id}`];
        assert.equal(claire.donations, 2);
        assert.equal(claire.total_eur, 80);
        assert.equal(claire.recurring, true);
        assert.equal(claire.main_currency, "eur");
        assert.equal(claire.region, "Littoral");
        const big = byKey["e:gros@test.hope.org"];
        assert.equal(big.main_currency, "xaf");
        assert.equal(Math.round(big.total_eur), 2000);
        assert.equal(byKey["e:petit@test.hope.org"].total_eur, 15, "remboursement deduit");
        assert.equal(res.body.items[0].donor_key, "e:gros@test.hope.org", "tri par total");
    });

    it("filtre par segment", async () => {
        const http = await loginAs(manager);
        const keys = async (query) => (await http.get(`/api/engagement/donors?${query}`)).body.items.map((d) => d.donor_key).sort();
        assert.deepEqual(await keys("segment=recurring"), [`u:${account.id}`]);
        assert.deepEqual(await keys("segment=inactive"), ["e:gros@test.hope.org"]);
        assert.deepEqual(await keys("segment=diaspora_eur"), ["e:petit@test.hope.org", `u:${account.id}`].sort());
        assert.deepEqual(await keys("segment=major"), ["e:gros@test.hope.org"]);
        assert.deepEqual(await keys("segment=major&threshold=50"), ["e:gros@test.hope.org", `u:${account.id}`].sort());
        assert.deepEqual(await keys("segment=region&region=Littoral"), [`u:${account.id}`]);
        assert.deepEqual(await keys("q=petit"), ["e:petit@test.hope.org"]);
        assert.equal((await http.get("/api/engagement/donors?segment=inconnu")).status, 400);
        assert.equal((await http.get("/api/engagement/donors?segment=region")).status, 400);
        assert.equal((await http.get("/api/engagement/donors?region=Atlantide")).status, 400);
    });

    it("affiche la fiche donateur, ses notes et etiquettes", async () => {
        const http = await loginAs(manager);
        const key = encodeURIComponent(`u:${account.id}`);
        const sheet = await http.get(`/api/engagement/donors/${key}`);
        assert.equal(sheet.status, 200);
        assert.equal(sheet.body.donations.length, 2);
        assert.equal(sheet.body.donations.find((d) => d.project_title).project_title, "École de Kribi");
        assert.ok(sheet.body.preferences);

        const note = await http.post(`/api/engagement/donors/${key}/notes`, { body: "Appel de remerciement fait" });
        assert.equal(note.status, 201);
        assert.equal(note.body[0].body, "Appel de remerciement fait");
        const tags = await http.agent.put(`/api/engagement/donors/${key}/tags`).set("X-Requested-With", "XMLHttpRequest")
            .send({ tags: ["Ambassadeur", "ambassadeur", "Église locale"] });
        assert.deepEqual(tags.body.tags, ["ambassadeur", "église-locale"]);
        const tagged = await http.get("/api/engagement/donors?tag=ambassadeur");
        assert.deepEqual(tagged.body.items.map((d) => d.donor_key), [`u:${account.id}`]);
        assert.deepEqual(tagged.body.items[0].tags, ["ambassadeur", "église-locale"]);

        const removed = await http.delete(`/api/engagement/donors/${key}/notes/${note.body[0].id}`);
        assert.equal(removed.status, 200);
        assert.equal(removed.body.length, 0);
        assert.equal((await http.delete(`/api/engagement/donors/${key}/notes/999999`)).status, 404);
        assert.equal((await http.get(`/api/engagement/donors/${encodeURIComponent("e:personne@test.hope.org")}`)).status, 404);
        assert.equal((await http.get("/api/engagement/donors/n%27importe")).status, 404);
    });

    it("exporte un segment en CSV, protege contre les formules et journalise l'export", async () => {
        const http = await loginAs(manager);
        const res = await http.get("/api/engagement/donors/export.csv?segment=major");
        assert.equal(res.status, 200);
        assert.match(res.headers["content-type"], /text\/csv/);
        assert.match(res.headers["content-disposition"], /donateurs-major-/);
        assert.equal(res.text.charCodeAt(0), 0xfeff, "BOM pour les tableurs");
        const lines = res.text.slice(1).trim().split("\r\n");
        assert.equal(lines.length, 2);
        assert.match(lines[1], /'=HYPERLINK/);
        const log = await lastLog("donor.export");
        assert.equal(log.meta.segment, "major");
        assert.equal(log.meta.rows, 1);
        assert.equal(csvCell("@cmd"), "'@cmd");
        assert.equal(csvCell("a;b"), "\"a;b\"");
    });
});
