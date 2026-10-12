const { db, request, app, resetDatabase, createUser, loginAs, insertProject, lastLog } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const emailService = require("../services/emailService");

async function captureEmails(fn) {
    const original = emailService.send;
    const sent = [];
    emailService.send = async (mail) => {
        sent.push(mail);
        return { sent: false, reason: "test" };
    };
    try {
        await fn();
        await new Promise((resolve) => setTimeout(resolve, 40));
    } finally {
        emailService.send = original;
    }
    return sent;
}

describe("workflow de validation des contenus", () => {
    let admin, adminHttp, secretary, secretaryHttp, orga, orgaHttp, regional, regionalHttp, westProject;

    before(async () => {
        await resetDatabase();
        admin = await createUser({ roles: ["admin"] });
        secretary = await createUser({ roles: ["secretaire_generale"] });
        orga = await createUser({ roles: ["organisatrice"] });
        regional = await createUser({ roles: ["directrice_regionale"], region: "Ouest" });
        [adminHttp, secretaryHttp, orgaHttp, regionalHttp] = await Promise.all([admin, secretary, orga, regional].map(loginAs));
        westProject = await insertProject({ title: "Projet Ouest", region: "Ouest" });
    });

    after(() => db.end());

    it("garde la compatibilite des contenus existants (published -> statut)", async () => {
        const hidden = await insertProject({ title: "Brouillon ancien", published: 0 });
        const list = await adminHttp.get("/api/admin/content/projects");
        assert.equal(list.body.find((item) => item.id === westProject).review_status, "published");
        assert.equal(list.body.find((item) => item.id === hidden).review_status, "draft");
    });

    it("publie directement pour une personne habilitee", async () => {
        const res = await adminHttp.post("/api/admin/content/news", { title: "Direct", content: "Texte publie", published: "1" });
        assert.equal(res.status, 201);
        assert.equal(res.body.published, true);
        assert.equal(res.body.review_status, "published");
    });

    it("soumet au lieu de publier sans APPROVE_CONTENT", async () => {
        const res = await orgaHttp.post("/api/admin/content/news", { title: "A valider", content: "Texte soumis", published: "1" });
        assert.equal(res.status, 201);
        assert.equal(res.body.published, false);
        assert.equal(res.body.review_status, "submitted");
        assert.equal(res.body.submitted_by, orga.id);
        assert.equal((await request(app).get(`/api/content/news/${res.body.id}`)).status, 404);
        const log = await lastLog("content.submit.news");
        assert.equal(log.meta.id, res.body.id);

        const draft = await orgaHttp.post("/api/admin/content/news", { title: "Brouillon", content: "Pas encore", published: "0" });
        assert.equal(draft.body.review_status, "draft");
    });

    it("fait soumettre une directrice regionale et retire du site un contenu publie modifie", async () => {
        const res = await regionalHttp.patch(`/api/admin/content/projects/${westProject}`, { title: "Projet Ouest v2" });
        assert.equal(res.status, 200);
        assert.equal(res.body.review_status, "submitted");
        assert.equal(res.body.published, false);
        const publicList = await request(app).get("/api/content/projects");
        assert.ok(!publicList.body.some((item) => item.id === westProject));
    });

    it("reserve la file aux relecteurs (pas aux directrices regionales)", async () => {
        assert.equal((await orgaHttp.get("/api/admin/content-review/queue")).status, 403);
        assert.equal((await regionalHttp.get("/api/admin/content-review/queue")).status, 403);
        const queue = await secretaryHttp.get("/api/admin/content-review/queue");
        assert.equal(queue.status, 200);
        assert.deepEqual(queue.body.map((item) => item.type).sort(), ["news", "projects"]);
        const count = await secretaryHttp.get("/api/admin/content-review/count");
        assert.equal(count.body.pending, 2);
    });

    it("approuve et publie, avec email a l'auteur et journal", async () => {
        const [[news]] = await db.query("SELECT id FROM news WHERE title = 'A valider'");
        const preview = await secretaryHttp.get(`/api/admin/content-review/news/${news.id}`);
        assert.equal(preview.status, 200);
        assert.equal(preview.body.submitted_by_name, "Test organisatrice");
        assert.equal(preview.body.history[0].action, "submit");

        const sent = await captureEmails(async () => {
            const res = await secretaryHttp.post(`/api/admin/content-review/news/${news.id}/approve`, { comment: "Bravo" });
            assert.equal(res.status, 200);
            assert.equal(res.body.published, true);
            assert.equal(res.body.review_status, "published");
        });
        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, orga.email);
        assert.match(sent[0].subject, /validé/);
        assert.equal((await request(app).get(`/api/content/news/${news.id}`)).status, 200);
        assert.ok(await lastLog("content.approve.news"));
        // Deja traite : plus en attente.
        assert.equal((await secretaryHttp.post(`/api/admin/content-review/news/${news.id}/approve`, {})).status, 409);
    });

    it("refuse avec un commentaire obligatoire, puis permet de resoumettre", async () => {
        assert.equal((await adminHttp.post(`/api/admin/content-review/projects/${westProject}/reject`, {})).status, 422);
        const sent = await captureEmails(async () => {
            const res = await adminHttp.post(`/api/admin/content-review/projects/${westProject}/reject`, { comment: "Ajoutez une photo" });
            assert.equal(res.status, 200);
            assert.equal(res.body.review_status, "rejected");
            assert.equal(res.body.review_comment, "Ajoutez une photo");
            assert.equal(res.body.published, false);
        });
        assert.equal(sent[0].to, regional.email);
        assert.match(sent[0].text, /Ajoutez une photo/);

        const resubmit = await regionalHttp.post(`/api/admin/content-review/projects/${westProject}/submit`);
        assert.equal(resubmit.status, 200);
        assert.equal(resubmit.body.review_status, "submitted");
        assert.equal((await regionalHttp.post(`/api/admin/content-review/projects/${westProject}/submit`)).status, 409);
    });

    it("refuse les soumissions hors region et les decisions non habilitees", async () => {
        const centre = await insertProject({ title: "Centre", region: "Centre", published: 0 });
        assert.equal((await regionalHttp.post(`/api/admin/content-review/projects/${centre}/submit`)).status, 403);
        assert.equal((await orgaHttp.post(`/api/admin/content-review/projects/${westProject}/approve`, {})).status, 403);
        assert.equal((await adminHttp.post("/api/admin/content-review/events/1/approve", {})).status, 422);
    });

    it("traite une seule decision en cas de relectures simultanees", async () => {
        const results = await captureEmails(() => Promise.all([
            adminHttp.post(`/api/admin/content-review/projects/${westProject}/approve`, {}),
            secretaryHttp.post(`/api/admin/content-review/projects/${westProject}/reject`, { comment: "Doublon" }),
        ]));
        assert.ok(results);
        const [[row]] = await db.query("SELECT review_status FROM projects WHERE id = ?", [westProject]);
        assert.ok(["published", "rejected"].includes(row.review_status));
        const [history] = await db.query(
            "SELECT action FROM content_reviews WHERE content_type = 'projects' AND content_id = ? AND action IN ('approve_publish', 'reject')",
            [westProject]
        );
        // Un refus anterieur + une seule des deux decisions simultanees.
        assert.equal(history.length, 2);
    });

    it("laisse une personne habilitee depublier (statut brouillon)", async () => {
        const res = await adminHttp.post("/api/admin/content/testimonials", { author: "Awa", content: "Merci", published: "1" });
        const off = await adminHttp.patch(`/api/admin/content/testimonials/${res.body.id}`, { published: "0" });
        assert.equal(off.body.review_status, "draft");
        assert.equal(off.body.published, false);
    });
});
