const {
    db, resetDatabase, createUser, loginAs, insertProject, insertPayment, insertEvent, hoursFromNow,
} = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("portee regionale (directrice regionale)", () => {
    let regional, regionalHttp, admin, adminHttp, westProject, centreProject;

    before(async () => {
        await resetDatabase();
        admin = await createUser({ roles: ["admin"] });
        regional = await createUser({ roles: ["directrice_regionale"], region: "Ouest" });
        regionalHttp = await loginAs(regional);
        adminHttp = await loginAs(admin);
        westProject = await insertProject({ title: "Projet Ouest", region: "Ouest" });
        centreProject = await insertProject({ title: "Projet Centre", region: "Centre" });
    });

    after(() => db.end());

    describe("projets", () => {
        it("ne liste que les projets de sa region", async () => {
            const res = await regionalHttp.get("/api/admin/content/projects");
            assert.equal(res.status, 200);
            assert.deepEqual(res.body.map((project) => project.id), [westProject]);

            const all = await adminHttp.get("/api/admin/content/projects");
            assert.equal(all.body.length, 2);
        });

        it("refuse de modifier ou supprimer un projet d'une autre region (403)", async () => {
            assert.equal((await regionalHttp.patch(`/api/admin/content/projects/${centreProject}`, { title: "Piratage" })).status, 403);
            assert.equal((await regionalHttp.delete(`/api/admin/content/projects/${centreProject}`)).status, 403);
            const [[row]] = await db.query("SELECT title FROM projects WHERE id = ?", [centreProject]);
            assert.equal(row.title, "Projet Centre");
        });

        it("modifie un projet de sa region sans pouvoir le deplacer", async () => {
            const res = await regionalHttp.patch(`/api/admin/content/projects/${westProject}`, { title: "Projet Ouest v2", region: "Centre" });
            assert.equal(res.status, 200);
            assert.equal(res.body.title, "Projet Ouest v2");
            assert.equal(res.body.region, "Ouest");
        });

        it("force sa region a la creation", async () => {
            const res = await regionalHttp.post("/api/admin/content/projects", {
                title: "Nouveau projet", description: "Un projet cree par la region", region: "Centre",
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.region, "Ouest");
        });

        it("laisse l'admin modifier tous les projets", async () => {
            assert.equal((await adminHttp.patch(`/api/admin/content/projects/${centreProject}`, { summary: "ok" })).status, 200);
        });
    });

    describe("actualites et temoignages", () => {
        it("impose un rattachement a un projet de sa region", async () => {
            const none = await regionalHttp.post("/api/admin/content/news", { title: "Sans projet", content: "Contenu de test" });
            assert.equal(none.status, 403);

            const other = await regionalHttp.post("/api/admin/content/news", { title: "Autre", content: "Contenu", project_id: centreProject });
            assert.equal(other.status, 403);

            const ok = await regionalHttp.post("/api/admin/content/news", { title: "Chez nous", content: "Contenu", project_id: westProject });
            assert.equal(ok.status, 201);

            const move = await regionalHttp.patch(`/api/admin/content/news/${ok.body.id}`, { project_id: centreProject });
            assert.equal(move.status, 403);
            const detach = await regionalHttp.patch(`/api/admin/content/news/${ok.body.id}`, { project_id: "" });
            assert.equal(detach.status, 403);
        });

        it("ne voit et ne modifie que ceux lies a sa region", async () => {
            const [orphan] = await db.query("INSERT INTO testimonials (author, content) VALUES ('Anonyme', 'Sans projet')");
            const [linked] = await db.query("INSERT INTO testimonials (author, content, project_id) VALUES ('Centre', 'Projet du Centre', ?)", [centreProject]);
            const [mine] = await db.query("INSERT INTO testimonials (author, content, project_id) VALUES ('Ouest', 'Projet de l''Ouest', ?)", [westProject]);

            const list = await regionalHttp.get("/api/admin/content/testimonials");
            assert.deepEqual(list.body.map((row) => row.id), [mine.insertId]);
            assert.equal((await regionalHttp.patch(`/api/admin/content/testimonials/${orphan.insertId}`, { author: "X" })).status, 403);
            assert.equal((await regionalHttp.delete(`/api/admin/content/testimonials/${linked.insertId}`)).status, 403);
            assert.equal((await regionalHttp.patch(`/api/admin/content/testimonials/${mine.insertId}`, { author: "Ouest 2" })).status, 200);
        });
    });

    describe("statistiques", () => {
        before(async () => {
            const donor = await createUser({ roles: ["membre"], region: "Ouest" });
            await createUser({ roles: ["membre"], region: "Centre" });
            await insertPayment({ amount: 100, projectId: westProject, userId: donor.id, email: "DONOR@test.hope.org" });
            await insertPayment({ amount: 1000, projectId: centreProject, email: "autre@test.hope.org" });
            await insertPayment({ amount: 50, projectId: null, email: "general@test.hope.org" });
            await insertEvent({ title: "Ouest", region: "Ouest", startAt: hoursFromNow(24) });
            await insertEvent({ title: "Centre", region: "Centre", startAt: hoursFromNow(24) });
        });

        it("n'inclut pas les dons ni les membres d'une autre region", async () => {
            const res = await regionalHttp.get("/api/admin/stats");
            assert.equal(res.status, 200);
            assert.equal(res.body.region, "Ouest");
            assert.equal(res.body.totalDonations, 100);
            assert.equal(res.body.donationsCount, 1);
            assert.equal(res.body.donorsCount, 1);
            assert.equal(res.body.upcomingEvents, 1);
            const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE region = 'Ouest'");
            assert.equal(res.body.members, Number(total));
        });

        it("laisse les roles globaux voir tous les chiffres", async () => {
            const res = await adminHttp.get("/api/admin/stats");
            assert.equal(res.body.region, null);
            assert.equal(res.body.totalDonations, 1150);
            assert.equal(res.body.upcomingEvents, 2);
        });

        it("filtre le rapport annuel sur sa region", async () => {
            const res = await regionalHttp.get("/api/admin/reports/annual");
            assert.equal(res.status, 200);
            assert.equal(res.body.region, "Ouest");
            assert.equal(res.body.finance.totalEur, 100);
            assert.ok(res.body.activity.projects.every((project) => project.region === "Ouest"));
            assert.equal(res.body.activity.events, 1);
        });

        it("ne donne pas acces au bilan financier sans la permission", async () => {
            assert.equal((await regionalHttp.get("/api/admin/finance/summary")).status, 403);
        });

        it("limite le bilan financier a sa region en cas de cumul de roles", async () => {
            const combo = await createUser({ roles: ["directrice_regionale", "responsable_finance"], region: "Ouest" });
            const http = await loginAs(combo);
            const summary = await http.get("/api/admin/finance/summary");
            assert.equal(summary.status, 200);
            assert.equal(summary.body.totalEur, 100);
            const donations = await http.get("/api/admin/donations");
            assert.ok(donations.body.every((row) => row.project_region === "Ouest"));
        });
    });

    it("refuse proprement une directrice regionale sans region", async () => {
        const lost = await createUser({ roles: ["directrice_regionale"] });
        const http = await loginAs(lost);
        assert.equal((await http.get("/api/admin/content/projects")).status, 403);
        assert.equal((await http.get("/api/admin/stats")).status, 403);
        assert.equal((await http.get("/api/admin/regional")).status, 403);
    });

    it("ne restreint pas les roles sans tableau de bord regional", async () => {
        const orga = await createUser({ roles: ["organisatrice"], region: "Ouest" });
        const http = await loginAs(orga);
        assert.equal((await http.patch(`/api/admin/content/projects/${centreProject}`, { summary: "orga" })).status, 200);
        assert.equal((await http.get("/api/admin/stats")).body.region, null);
    });
});
