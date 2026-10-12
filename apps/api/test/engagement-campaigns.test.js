const { db, request, app, resetDatabase, createUser, createPayment, loginAs, insertProject, lastLog } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const campaignService = require("../services/campaignService");
const consentService = require("../services/consentService");

async function subscribe(email, userId = null) {
    await consentService.applyChanges({ email, userId }, { newsletter: true }, { source: "newsletter_form" });
}

describe("engagement : newsletter, campagnes et nouvelles des projets", () => {
    let manager;
    let member;
    let projectId;
    let newsId;

    before(async () => {
        await resetDatabase();
        manager = await createUser({ roles: ["secretaire_generale"], name: "Sabine Secrétaire" });
        member = await createUser({ roles: ["membre"], name: "Marc Membre", email: "marc@test.hope.org" });
        await subscribe("alice@test.hope.org");
        await subscribe("bob@test.hope.org");
        await subscribe(member.email, member.id);
        await subscribe("parti@test.hope.org");
        await consentService.applyChanges({ email: "parti@test.hope.org" }, { newsletter: false }, { source: "account" });

        projectId = await insertProject({ title: "Forage de Garoua" });
        await db.query("UPDATE projects SET goal_amount = 1000 WHERE id = ?", [projectId]);
        await createPayment({ status: "succeeded", amount: 100, project_id: projectId, donor_email: "alice@test.hope.org", donor_name: "Alice Martin" });
        await createPayment({ status: "succeeded", amount: 150, project_id: projectId, user_id: member.id, donor_email: member.email });
        await createPayment({ status: "succeeded", amount: 50, project_id: projectId, donor_email: "refus@test.hope.org" });
        await createPayment({ status: "failed", amount: 70, project_id: projectId, donor_email: "echec@test.hope.org" });
        await consentService.applyChanges({ email: "refus@test.hope.org" }, { project_news: false }, { source: "account" });
        const [result] = await db.query(
            "INSERT INTO news (title, summary, content, project_id, published) VALUES ('Le forage est terminé', 'Résumé', 'Contenu', ?, 1)",
            [projectId]
        );
        newsId = result.insertId;
        await db.query("INSERT INTO news (title, content, project_id, published) VALUES ('Brouillon', 'x', ?, 0)", [projectId]);
    });

    after(() => db.end());

    it("reserve les campagnes a la permission MANAGE_CAMPAIGNS", async () => {
        assert.equal((await request(app).get("/api/engagement/campaigns")).status, 401);
        assert.equal((await (await loginAs(member)).get("/api/engagement/campaigns")).status, 403);
    });

    it("gere des modeles reutilisables", async () => {
        const http = await loginAs(manager);
        const created = await http.post("/api/engagement/campaigns/templates", { name: "Merci", subject: "Merci {prenom}", body: "Bonjour {prenom}," });
        assert.equal(created.status, 201);
        const updated = await http.agent.put(`/api/engagement/campaigns/templates/${created.body.id}`).set("X-Requested-With", "XMLHttpRequest")
            .send({ name: "Merci !", subject: "Merci {prenom}", body: "Bonjour {prenom} !" });
        assert.equal(updated.body.name, "Merci !");
        assert.equal((await http.get("/api/engagement/campaigns/templates")).body.length, 1);
        assert.equal((await http.delete(`/api/engagement/campaigns/templates/${created.body.id}`)).status, 200);
        assert.equal((await http.delete(`/api/engagement/campaigns/templates/${created.body.id}`)).status, 404);
        assert.equal((await http.get("/api/engagement/campaigns/subscribers")).body.total, 3);
    });

    it("valide l'audience et le sujet d'une campagne", async () => {
        const http = await loginAs(manager);
        const base = { name: "Test", subject: "Objet", body: "Contenu" };
        assert.equal((await http.post("/api/engagement/campaigns", { ...base, audience: "tout-le-monde" })).status, 400);
        assert.equal((await http.post("/api/engagement/campaigns", { ...base, audience: "newsletter", topic: "project_news" })).status, 400);
        assert.equal((await http.post("/api/engagement/campaigns", { ...base, audience: "donors:region" })).status, 400);
        const ok = await http.post("/api/engagement/campaigns", { ...base, audience: "donors:major", topic: "donation_reminders", audienceParams: { threshold: 120 } });
        assert.equal(ok.status, 201);
        assert.equal(ok.body.audience_params.threshold, 120);
    });

    it("previsualise, envoie un test puis envoie par lots via la file, une seule fois", async () => {
        const http = await loginAs(manager);
        const created = await http.post("/api/engagement/campaigns", {
            name: "Lettre d'octobre", subject: "Bonjour {prenom}", body: "Chère {prenom} {nom}, voici nos nouvelles.", audience: "newsletter",
        });
        const id = created.body.id;

        const preview = await http.get(`/api/engagement/campaigns/${id}/preview`);
        assert.equal(preview.status, 200);
        assert.equal(preview.body.recipients, 3, "le desabonne est exclu");
        assert.match(preview.body.text, /preferences\?token=/);

        const test = await http.post(`/api/engagement/campaigns/${id}/test`);
        assert.equal(test.status, 200);
        assert.ok(await lastLog("campaign.test_sent"));

        // Desinscription entre l'apercu et l'envoi : respectee.
        await consentService.applyChanges({ email: "bob@test.hope.org" }, { newsletter: false }, { source: "account" });

        process.env.CAMPAIGN_BATCH_SIZE = "2";
        try {
            const sent = await http.post(`/api/engagement/campaigns/${id}/send`);
            assert.equal(sent.status, 200);
            assert.equal(sent.body.queued, 2);
            assert.equal(sent.body.remaining, 0, "bob n'est plus dans l'audience");
            assert.equal(sent.body.campaign.status, "sent");
        } finally {
            delete process.env.CAMPAIGN_BATCH_SIZE;
        }

        const [rows] = await db.query("SELECT to_address, subject, body_text, kind FROM email_outbox WHERE kind = 'campaign' ORDER BY to_address");
        assert.deepEqual(rows.map((row) => row.to_address), ["alice@test.hope.org", "marc@test.hope.org"]);
        const marc = rows.find((row) => row.to_address === "marc@test.hope.org");
        assert.equal(marc.subject, "Bonjour Marc");
        assert.match(marc.body_text, /^Chère Marc Membre, voici nos nouvelles\./);
        assert.match(marc.body_text, /preferences\?token=/);

        assert.equal((await http.post(`/api/engagement/campaigns/${id}/send`)).status, 409);
        assert.equal((await http.agent.put(`/api/engagement/campaigns/${id}`).set("X-Requested-With", "XMLHttpRequest")
            .send({ name: "Autre", subject: "Autre", body: "Autre" })).status, 409);
        assert.equal((await http.delete(`/api/engagement/campaigns/${id}`)).status, 409);

        // Statistiques : envoyes, echecs, desinscriptions rattachees a la campagne.
        await db.query("UPDATE email_outbox SET status = 'sent' WHERE to_address = 'alice@test.hope.org' AND kind = 'campaign'");
        await db.query("UPDATE email_outbox SET status = 'failed' WHERE to_address = 'marc@test.hope.org' AND kind = 'campaign'");
        const token = consentService.preferencesToken("alice@test.hope.org", { campaignId: id });
        await request(app).post("/api/engagement/unsubscribe").send({ token, topic: "newsletter" });
        const detail = await http.get(`/api/engagement/campaigns/${id}`);
        assert.deepEqual(detail.body.stats, { recipients: 2, skipped: 0, sent: 1, failed: 1, pending: 0, unsubscribed: 1 });
    });

    it("reprend un envoi par lots avec le worker", async () => {
        const actor = { id: manager.id };
        for (const email of ["c1@test.hope.org", "c2@test.hope.org", "c3@test.hope.org"]) await subscribe(email);
        const campaign = await campaignService.createCampaign(actor, { name: "Lots", subject: "Lots", body: "Texte", audience: "newsletter" });
        process.env.CAMPAIGN_BATCH_SIZE = "2";
        try {
            const first = await campaignService.send(actor, campaign.id);
            assert.equal(first.queued, 2);
            assert.ok(first.remaining > 0);
            assert.equal(first.campaign.status, "sending");
            await campaignService.processPending();
            await campaignService.processPending();
            const done = await campaignService.getCampaign(campaign.id);
            assert.equal(done.status, "sent");
            assert.equal(done.stats.recipients, 4, "c1, c2, c3 et marc");
        } finally {
            delete process.env.CAMPAIGN_BATCH_SIZE;
        }
    });

    it("cible un segment du CRM avec le sujet choisi", async () => {
        const http = await loginAs(manager);
        const created = await http.post("/api/engagement/campaigns", {
            name: "Grands donateurs", subject: "Merci", body: "Merci {prenom}", audience: "donors:major", topic: "donation_reminders", audienceParams: { threshold: 120 },
        });
        const preview = await http.get(`/api/engagement/campaigns/${created.body.id}/preview`);
        assert.equal(preview.body.recipients, 1, "seul le compte a 150 EUR depasse le seuil");
    });

    it("envoie une actualite aux donateurs du projet qui l'acceptent, une seule fois", async () => {
        const http = await loginAs(manager);
        const list = await http.get("/api/engagement/campaigns/project-news");
        assert.deepEqual(list.body.map((n) => n.id), [newsId], "actualites publiees liees a un projet");

        const preview = await http.get(`/api/engagement/campaigns/project-news/${newsId}/preview`);
        assert.equal(preview.status, 200);
        assert.equal(preview.body.recipients, 2, "refus et don echoue exclus");
        assert.match(preview.body.subject, /Forage de Garoua/);

        const sent = await http.post(`/api/engagement/campaigns/project-news/${newsId}/send`);
        assert.equal(sent.status, 200);
        assert.equal(sent.body.recipients, 2);
        const again = await http.post(`/api/engagement/campaigns/project-news/${newsId}/send`);
        assert.equal(again.status, 409);
        const [rows] = await db.query("SELECT to_address FROM email_outbox WHERE kind = 'project_news' ORDER BY to_address");
        assert.deepEqual(rows.map((row) => row.to_address), ["alice@test.hope.org", "marc@test.hope.org"]);
        assert.ok((await http.get("/api/engagement/campaigns/project-news")).body[0].dispatched_at);
        const [[draft]] = await db.query("SELECT id FROM news WHERE published = 0");
        assert.equal((await http.post(`/api/engagement/campaigns/project-news/${draft.id}/send`)).status, 404);
    });

    it("liste les projets soutenus par le membre avec progression et actualites", async () => {
        const http = await loginAs(member);
        const res = await http.get("/api/engagement/me/supported-projects");
        assert.equal(res.status, 200);
        assert.equal(res.body.length, 1);
        const [project] = res.body;
        assert.equal(project.title, "Forage de Garoua");
        assert.equal(project.my_total_eur, 150);
        assert.equal(project.raised_eur, 300);
        assert.equal(project.progress, 30);
        assert.deepEqual(project.news.map((n) => n.title), ["Le forage est terminé"]);
    });
});
