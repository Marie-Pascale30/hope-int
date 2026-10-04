const {
    db, request, app, resetDatabase, createUser, loginAs, client, insertProject, insertPayment, insertEvent, lastLog, hoursFromNow, PASSWORD,
} = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("statistiques, rapport annuel et journal", () => {
    let admin, adminHttp;

    before(async () => {
        await resetDatabase();
        admin = await createUser({ roles: ["admin"] });
        adminHttp = await loginAs(admin);
    });

    after(() => db.end());

    it("calcule l'impact du rapport annuel sur les projets actifs dans l'annee", async () => {
        await insertProject({ title: "2023", start_date: "2023-01-01", end_date: "2023-12-31", beneficiaries: 100 });
        await insertProject({ title: "2023-2025", start_date: "2023-06-01", end_date: "2025-06-30", beneficiaries: 20 });
        await insertProject({ title: "2025", start_date: "2025-01-01", end_date: null, beneficiaries: 7 });

        const report = await adminHttp.get("/api/admin/reports/annual?year=2024");
        assert.equal(report.status, 200);
        assert.equal(report.body.impact.projects, 1);
        assert.equal(report.body.impact.beneficiaries, 20);
        assert.equal(report.body.impactScope.basis, "projects_active_in_year");
        assert.deepEqual(report.body.activity.projects.map((project) => project.title), ["2023-2025"]);

        const in2023 = await adminHttp.get("/api/admin/reports/annual?year=2023");
        assert.equal(in2023.body.impact.beneficiaries, 120);
    });

    it("compte un evenement en cours comme a venir, comme l'agenda public", async () => {
        await insertEvent({ title: "En cours", startAt: hoursFromNow(-1), endAt: hoursFromNow(2) });
        await insertEvent({ title: "Termine", startAt: hoursFromNow(-5), endAt: hoursFromNow(-4) });
        await insertEvent({ title: "Futur", startAt: hoursFromNow(24) });

        const stats = await adminHttp.get("/api/admin/stats");
        const publicList = await request(app).get("/api/events");
        assert.equal(stats.body.upcomingEvents, 2);
        assert.equal(publicList.body.length, stats.body.upcomingEvents);
    });

    it("compte les donateurs uniques de la meme facon partout", async () => {
        const donor = await createUser({ roles: ["membre"] });
        const project = await insertProject({ title: "Campagne" });
        await insertPayment({ amount: 10, userId: donor.id, email: donor.email, projectId: project });
        await insertPayment({ amount: 10, userId: donor.id, email: null, projectId: project });
        await insertPayment({ amount: 10, email: "Anonyme@Test.hope.org", projectId: project });
        await insertPayment({ amount: 10, email: "anonyme@test.hope.org", projectId: project });

        const stats = await adminHttp.get("/api/admin/stats");
        const impact = await request(app).get("/api/impact");
        const campaign = await request(app).get(`/api/content/projects/${project}`);
        assert.equal(stats.body.donorsCount, 2);
        assert.equal(impact.body.donors, 2);
        assert.equal(campaign.body.donors_count, 2);
    });

    it("journalise l'export CSV des dons", async () => {
        const res = await adminHttp.get("/api/admin/finance/export?status=succeeded");
        assert.equal(res.status, 200);
        const log = await lastLog("finance.export_donations");
        assert.equal(log.user_id, admin.id);
        assert.equal(log.meta.rows, 4);
        assert.equal(log.meta.filters.status, "succeeded");
    });

    it("journalise une tentative de connexion sur un compte desactive", async () => {
        const user = await createUser({ roles: ["membre"] });
        await db.query("UPDATE users SET status = 'inactive' WHERE id = ?", [user.id]);

        const res = await client().post("/api/auth/login", { email: user.email, password: PASSWORD });
        assert.equal(res.status, 401);
        const log = await lastLog("auth.login_inactive");
        assert.equal(log.user_id, user.id);
    });

    it("enregistre l'ancien et le nouveau statut dans hr.update_profile", async () => {
        const user = await createUser({ roles: ["membre"], region: "Sud" });
        const res = await adminHttp.patch(`/api/admin/users/${user.id}/profile`, { status: "inactive" });
        assert.equal(res.status, 200);
        assert.equal(res.body.user.region, "Sud", "un champ absent n'est pas ecrase");

        const log = await lastLog("hr.update_profile");
        assert.deepEqual(log.meta.status, { from: "active", to: "inactive" });
        assert.deepEqual(log.meta.fields, ["status"]);
    });
});
