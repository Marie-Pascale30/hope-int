// Page publique "Transparence" (publication annuelle, agregats sans donnees personnelles),
// documents publics, carte des regions et portraits de l'equipe (consentement).
const os = require("os");
const fs = require("fs");
const path = require("path");

const PRIVATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hope-private-"));
process.env.PRIVATE_UPLOADS_DIR = PRIVATE_DIR;

const {
    db, request, app, resetDatabase, createUser, loginAs, insertProject, insertPayment, insertEvent, lastLog, hoursFromNow, PNG_BYTES,
} = require("./fixtures");
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const transparencyService = require("../services/transparencyService");
const { removeUpload } = require("../utils/uploads");

const PDF_BYTES = Buffer.from("%PDF-1.7\n%%EOF\n", "latin1");

function multipartAs(http, method, url, fields, file, fieldName) {
    let req = http.agent[method](url).set("X-Requested-With", "XMLHttpRequest");
    for (const [key, value] of Object.entries(fields)) req = req.field(key, String(value));
    if (file) req = req.attach(fieldName, file.buffer, { filename: file.filename, contentType: file.contentType });
    return req;
}

describe("transparence : pages publiques", () => {
    let admin, adminHttp, financeHttp, published, hidden;
    const createdUploads = [];

    before(async () => {
        await resetDatabase();
        admin = await createUser({ roles: ["admin"] });
        adminHttp = await loginAs(admin);
        financeHttp = await loginAs(await createUser({ roles: ["responsable_finance"] }));
        published = await insertProject({ title: "Microcrédit Bafoussam", region: "Ouest", beneficiaries: 80, start_date: "2024-01-01" });
        hidden = await insertProject({ title: "Projet confidentiel", region: "Centre", published: 0, start_date: "2024-01-01" });
    });

    beforeEach(() => transparencyService.clearCache());

    after(async () => {
        for (const url of createdUploads) await removeUpload(url);
        await db.end();
        fs.rmSync(PRIVATE_DIR, { recursive: true, force: true });
    });

    it("ne publie rien tant que la direction n'a pas publie l'annee", async () => {
        await insertPayment({ amount: 100, projectId: published, email: "alice@test.hope.org", paidAt: new Date("2025-03-01T12:00:00Z") });
        const res = await request(app).get("/api/transparency/2025");
        assert.equal(res.status, 404);
        const index = await request(app).get("/api/transparency");
        assert.deepEqual(index.body.years, []);
        assert.equal((await request(app).get("/api/transparency/1800")).status, 400);
    });

    it("reserve la publication a la direction (portee nationale)", async () => {
        const res = await financeHttp.agent.put("/api/transparency/admin/years/2025")
            .set("X-Requested-With", "XMLHttpRequest").send({ published: true });
        assert.equal(res.status, 403);
    });

    it("publie des agregats : recettes nettes, par moyen et par projet, depenses, impact", async () => {
        const refunded = await insertPayment({ amount: 50, projectId: published, paidAt: new Date("2025-04-01T12:00:00Z") });
        await db.query("UPDATE payments SET refunded_amount = 10 WHERE id = ?", [refunded]);
        await insertPayment({ amount: 65595.7, currency: "xaf", projectId: hidden, paidAt: new Date("2025-05-01T12:00:00Z") });
        await insertPayment({ amount: 30, paidAt: new Date("2025-06-01T12:00:00Z") });
        await insertPayment({ amount: 999, projectId: published, status: "refunded", paidAt: new Date("2025-06-01T12:00:00Z") });
        await db.query(
            "INSERT INTO expenses (project_id, category, amount, currency, spent_on, description) VALUES (?, 'training', 40, 'eur', '2025-02-01', 'Formation'), (NULL, 'administration', 15, 'eur', '2025-02-02', 'Bureau'), (?, 'equipment', 5, 'eur', '2024-12-31', 'Hors annee')",
            [published, published]
        );
        await db.query("INSERT INTO budget_lines (project_id, category, amount, currency) VALUES (?, 'training', 200, 'eur')", [published]);

        const put = await adminHttp.agent.put("/api/transparency/admin/years/2025")
            .set("X-Requested-With", "XMLHttpRequest").send({ published: true, note: "Comptes validés par le bureau" });
        assert.equal(put.status, 200);
        assert.equal(put.body.published, true);
        assert.ok(await lastLog("transparency.year_publish"));

        const res = await request(app).get("/api/transparency/2025");
        assert.equal(res.status, 200);
        assert.match(res.headers["cache-control"], /public, max-age=300/);
        const body = res.body;
        assert.equal(body.revenue.totalEur, 100 + 40 + 100 + 30);
        assert.deepEqual(body.revenue.byMethod, [{ method: "card", amountEur: 270 }]);
        const byProject = Object.fromEntries(body.revenue.byProject.map((row) => [String(row.projectId), row]));
        assert.equal(byProject[published].amountEur, 140);
        assert.equal(byProject[published].title, "Microcrédit Bafoussam");
        assert.equal(byProject["0"].amountEur, 100, "projet non publie regroupe, sans titre");
        assert.equal(byProject["0"].title, null);
        assert.equal(byProject.null.amountEur, 30, "fonds general");
        assert.equal(body.expenses.totalEur, 55);
        assert.deepEqual(body.expenses.byCategory.map((row) => row.category).sort(), ["administration", "training"]);
        assert.equal(body.expenses.byProject.find((row) => row.projectId === published).plannedEur, 200);
        assert.equal(body.balanceEur, 215);
        assert.equal(body.impact.beneficiaries, 80, "projets publies actifs dans l'annee");
        assert.equal(body.note, "Comptes validés par le bureau");

        const json = JSON.stringify(body);
        assert.doesNotMatch(json, /alice@test|Donateur test|Projet confidentiel|donor/i);

        const index = await request(app).get("/api/transparency");
        assert.deepEqual(index.body.years, [2025]);
        assert.equal(index.body.latest, 2025);
    });

    it("retire une annee de la publication", async () => {
        await adminHttp.agent.put("/api/transparency/admin/years/2025").set("X-Requested-With", "XMLHttpRequest").send({ published: false });
        assert.equal((await request(app).get("/api/transparency/2025")).status, 404);
        await adminHttp.agent.put("/api/transparency/admin/years/2025").set("X-Requested-With", "XMLHttpRequest").send({ published: true });
        const years = await financeHttp.get("/api/transparency/admin/years");
        assert.equal(years.status, 200);
        assert.ok(years.body.years.find((row) => row.year === 2025).published);
    });

    it("televerse un rapport annuel PDF (signature verifiee), visible une fois l'annee publiee", async () => {
        const rejected = await multipartAs(financeHttp, "post", "/api/transparency/admin/documents",
            { title: "Rapport 2025", year: 2025 }, { buffer: PNG_BYTES, filename: "rapport.pdf", contentType: "application/pdf" }, "file");
        assert.equal(rejected.status, 400);
        const missing = await multipartAs(financeHttp, "post", "/api/transparency/admin/documents", { title: "Rapport 2025", year: 2025 }, null, "file");
        assert.equal(missing.status, 400);

        const created = await multipartAs(financeHttp, "post", "/api/transparency/admin/documents",
            { title: "Rapport annuel 2025", year: 2025, kind: "annual_report" }, { buffer: PDF_BYTES, filename: "rapport.pdf", contentType: "application/pdf" }, "file");
        assert.equal(created.status, 201, JSON.stringify(created.body));
        assert.match(created.body.file_url, /^\/uploads\/.+\.pdf$/);
        createdUploads.push(created.body.file_url);

        const draft = await multipartAs(financeHttp, "post", "/api/transparency/admin/documents",
            { title: "Brouillon 2024", year: 2024 }, { buffer: PDF_BYTES, filename: "b.pdf", contentType: "application/pdf" }, "file");
        createdUploads.push(draft.body.file_url);

        const index = await request(app).get("/api/transparency");
        assert.deepEqual(index.body.documents.map((doc) => doc.title), ["Rapport annuel 2025"], "annee 2024 non publiee : document masque");
        const year = await request(app).get("/api/transparency/2025");
        assert.equal(year.body.documents.length, 1);

        assert.equal((await financeHttp.delete(`/api/transparency/admin/documents/${draft.body.id}`)).status, 200);
    });

    it("agrege projets et evenements par region pour la carte", async () => {
        await insertEvent({ title: "Atelier", region: "Ouest", startAt: hoursFromNow(48) });
        await insertEvent({ title: "Passé", region: "Ouest", startAt: hoursFromNow(-48) });
        const res = await request(app).get("/api/transparency/regions");
        assert.equal(res.status, 200);
        assert.equal(res.body.regions.length, 10);
        const ouest = res.body.regions.find((row) => row.region === "Ouest");
        assert.deepEqual({ projects: ouest.projects, events: ouest.events }, { projects: 1, events: 1 });
        const centre = res.body.regions.find((row) => row.region === "Centre");
        assert.equal(centre.projects, 0, "projet non publie exclu");
    });

    it("n'affiche que les portraits consentis, sans email", async () => {
        const volunteer = await createUser({ roles: ["membre"], name: "Brice Bénévole", region: "Littoral" });
        const staff = await createUser({ roles: ["organisatrice"], name: "Odile Organisatrice" });
        const volunteerHttp = await loginAs(volunteer);

        assert.deepEqual((await request(app).get("/api/transparency/team")).body.members, []);

        const own = await multipartAs(volunteerHttp, "patch", "/api/transparency/team/me",
            { publicProfile: "1", title: "Bénévole terrain", bio: "J'anime les groupes d'épargne." }, { buffer: PNG_BYTES, filename: "moi.png", contentType: "image/png" }, "image");
        assert.equal(own.status, 200, JSON.stringify(own.body));
        assert.equal(own.body.publicProfile, true);
        assert.ok(own.body.consentAt);
        createdUploads.push(own.body.photoUrl);

        const hr = await loginAs(await createUser({ roles: ["responsable_rh"] }));
        const list = await hr.get("/api/transparency/admin/team");
        assert.equal(list.status, 200);
        const update = await multipartAs(hr, "patch", `/api/transparency/admin/team/${staff.id}`, { publicProfile: "1", title: "Coordinatrice" }, null, "image");
        assert.equal(update.status, 200);

        transparencyService.clearCache();
        const team = await request(app).get("/api/transparency/team");
        assert.equal(team.body.members.length, 2);
        const brice = team.body.members.find((member) => member.name === "Brice Bénévole");
        assert.equal(brice.group, "volunteers");
        assert.equal(brice.title, "Bénévole terrain");
        assert.match(brice.photoUrl, /^\/uploads\//);
        assert.equal(team.body.members.find((member) => member.name === "Odile Organisatrice").group, "team");
        assert.doesNotMatch(JSON.stringify(team.body), /@test\.hope\.org|"id"/);

        await multipartAs(volunteerHttp, "patch", "/api/transparency/team/me", { publicProfile: "0" }, null, "image");
        transparencyService.clearCache();
        assert.equal((await request(app).get("/api/transparency/team")).body.members.length, 1);

        const member = await loginAs(await createUser({ roles: ["membre"] }));
        assert.equal((await member.get("/api/transparency/admin/team")).status, 403);
    });
});
