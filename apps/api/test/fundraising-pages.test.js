const { db, resetDatabase, createUser, loginAs, client, mockMethods } = require("./helpers");
const { PNG_BYTES, insertProject } = require("./fixtures");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const emailService = require("../services/emailService");
const notchpayProvider = require("../services/payments/notchpayProvider");
const paymentRepo = require("../repositories/paymentRepository");
const { supporterName } = require("../services/fundraisingPageService");
const { removeUpload } = require("../utils/uploads");

let restore = [];
const mock = (target, methods) => restore.push(mockMethods(target, methods));
const tick = () => new Promise((resolve) => setTimeout(resolve, 80));
const STORY = "Je cours le semi-marathon de Douala pour financer la cantine scolaire de mon quartier. Merci !";

function createFundraiser(http, fields, image) {
    let req = http.agent.post("/api/fundraising/fundraisers").set("X-Requested-With", "XMLHttpRequest");
    for (const [key, value] of Object.entries(fields)) req = req.field(key, String(value));
    if (image) req = req.attach("image", image, { filename: "photo.png", contentType: "image/png" });
    return req;
}

describe("collectes personnelles", () => {
    let organizer;
    let moderator;
    let member;
    let projectId;
    let fundraiser;

    before(async () => {
        await resetDatabase();
        organizer = await loginAs(await createUser({ name: "Nadia Ekotto" }));
        member = await loginAs(await createUser());
        moderator = await loginAs(await createUser({ roles: ["organisatrice"] }));
        projectId = await insertProject({ title: "Cantine scolaire" });
        mock(emailService, { send: async () => ({ sent: true }) });
    });
    after(async () => {
        if (fundraiser?.image_url) await removeUpload(fundraiser.image_url);
        await tick();
        await db.end();
    });
    afterEach(() => {
        restore.slice(1).reverse().forEach((fn) => fn());
        restore = restore.slice(0, 1);
    });

    it("anonymise les noms des soutiens", () => {
        assert.equal(supporterName("Marie Ngo Bassa"), "Marie B.");
        assert.equal(supporterName("Paul"), "Paul");
        assert.equal(supporterName(""), null);
    });

    it("valide la saisie (authentification, projet, objectif, histoire)", async () => {
        assert.equal((await client().post("/api/fundraising/fundraisers", {})).status, 401);
        assert.equal((await createFundraiser(organizer, { title: "Cour", story: STORY, goalAmount: 500, currency: "eur", projectId })).status, 422);
        assert.equal((await createFundraiser(organizer, { title: "Ma course solidaire", story: STORY, goalAmount: 10, currency: "eur", projectId })).status, 400);
        assert.equal((await createFundraiser(organizer, { title: "Ma course solidaire", story: STORY, goalAmount: 500, currency: "eur", projectId: 9999 })).status, 400);
    });

    it("cree une collecte en attente de moderation, invisible publiquement", async () => {
        const res = await createFundraiser(organizer, {
            title: "Ma course solidaire", story: STORY, goalAmount: 500, currency: "eur", projectId,
        }, PNG_BYTES);
        assert.equal(res.status, 201);
        fundraiser = res.body;
        assert.equal(fundraiser.status, "pending");
        assert.match(fundraiser.slug, /^ma-course-solidaire-[a-f0-9]{6}$/);
        assert.match(fundraiser.image_url, /^\/uploads\/.+\.png$/);
        assert.equal((await client().get(`/api/fundraising/fundraisers/public/${fundraiser.slug}`)).status, 404);
        assert.equal((await organizer.get("/api/fundraising/fundraisers/mine")).body.length, 1);
    });

    it("moderation reservee a MANAGE_CONTENT, une seule decision", async () => {
        assert.equal((await member.post(`/api/fundraising/admin/fundraisers/${fundraiser.id}/moderate`, { decision: "approve" })).status, 403);
        const res = await moderator.post(`/api/fundraising/admin/fundraisers/${fundraiser.id}/moderate`, { decision: "approve" });
        assert.equal(res.status, 200);
        assert.equal(res.body.status, "published");
        assert.equal((await moderator.post(`/api/fundraising/admin/fundraisers/${fundraiser.id}/moderate`, { decision: "reject" })).status, 409);
        // Publiee : plus modifiable par l'organisateur.
        assert.equal((await organizer.patch(`/api/fundraising/fundraisers/${fundraiser.id}`, { title: "Nouveau titre" })).status, 409);
    });

    it("attribue les dons a la collecte et au projet, avec soutiens anonymisables", async () => {
        mock(notchpayProvider, {
            isEnabled: () => true,
            createPaymentLink: async () => ({ transactionId: `trx.f.${Date.now()}.${Math.random()}`, redirectUrl: "https://pay.example/x" }),
        });
        const donate = (body) => client().post("/api/payment/donations", {
            amount: 65596, provider: "mobile_money", phone: "+237690000000", fundraiser: fundraiser.slug, projectId: 9999, ...body,
        });
        const first = await donate({ donorName: "Marie Ngo Bassa", donorEmail: "marie@test.hope.org" });
        const second = await donate({ donorName: "Secret Donateur", donorEmail: "secret@test.hope.org", anonymous: true });
        assert.equal(first.status, 201);
        assert.equal(second.status, 201);
        const payment = await paymentRepo.findById(first.body.paymentId);
        assert.equal(payment.fundraiser_id, fundraiser.id);
        assert.equal(payment.project_id, projectId, "le projet de la collecte prime");
        assert.equal(payment.source, "collecte");
        await db.query("UPDATE payments SET status = 'succeeded', paid_at = NOW() WHERE fundraiser_id = ?", [fundraiser.id]);

        const page = await client().get(`/api/fundraising/fundraisers/public/${fundraiser.slug}`);
        assert.equal(page.status, 200);
        assert.equal(page.body.supporters_count, 2);
        assert.equal(page.body.raised, 200, "XAF converti dans la devise de la collecte");
        assert.equal(page.body.organizer, "Nadia");
        assert.equal(page.body.open, true);
        const names = page.body.supporters.map((row) => row.name);
        assert.ok(names.includes("Marie B."));
        assert.ok(names.includes(null));
        assert.equal(JSON.stringify(page.body).includes("@"), false, "aucun email expose");

        const list = await client().get(`/api/fundraising/fundraisers?projectId=${projectId}`);
        assert.equal(list.body.length, 1);
    });

    it("cloture par l'organisateur : plus aucun don accepte", async () => {
        assert.equal((await member.patch(`/api/fundraising/fundraisers/${fundraiser.id}`, { status: "closed" })).status, 404);
        const res = await organizer.patch(`/api/fundraising/fundraisers/${fundraiser.id}`, { status: "closed" });
        assert.equal(res.status, 200);
        assert.equal(res.body.status, "closed");
        mock(notchpayProvider, { isEnabled: () => true });
        const donation = await client().post("/api/payment/donations", {
            amount: 5000, provider: "mobile_money", phone: "+237690000000", fundraiser: fundraiser.slug, donorName: "Zoe", donorEmail: "z@test.hope.org",
        });
        assert.equal(donation.status, 400);
        assert.equal((await client().get(`/api/fundraising/fundraisers/public/${fundraiser.slug}`)).body.open, false);
    });

    it("collecte refusee : modifiable puis resoumise", async () => {
        const res = await createFundraiser(organizer, { title: "Anniversaire solidaire", story: STORY, goalAmount: 100000, currency: "xaf", projectId });
        await moderator.post(`/api/fundraising/admin/fundraisers/${res.body.id}/moderate`, { decision: "reject", note: "Précisez l'usage des fonds" });
        const edited = await organizer.patch(`/api/fundraising/fundraisers/${res.body.id}`, { story: `${STORY} Les fonds iront aux repas.` });
        assert.equal(edited.status, 200);
        assert.equal(edited.body.status, "pending");
        const pending = await moderator.get("/api/fundraising/admin/fundraisers?status=pending");
        assert.equal(pending.body.length, 1);
    });
});
