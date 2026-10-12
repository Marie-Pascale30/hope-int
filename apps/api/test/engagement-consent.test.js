const { db, request, app, resetDatabase, createUser, client, loginAs, mockMethods } = require("./helpers");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const preferences = require("../services/preferences");
const consentService = require("../services/consentService");
const emailService = require("../services/emailService");
const tokens = require("../services/engagementTokens");

const tokenFrom = (text) => decodeURIComponent(/token=([^&\s]+)/.exec(text)[1]);

describe("engagement : preferences et consentements", () => {
    let member;

    before(async () => {
        await resetDatabase();
        member = await createUser({ email: "membre.prefs@test.hope.org" });
    });

    after(() => db.end());

    it("applique les regles par defaut : newsletter en opt-in, autres sujets en opt-out", async () => {
        assert.equal(await preferences.canContact("inconnu@test.hope.org", "newsletter"), false);
        assert.equal(await preferences.canContact("inconnu@test.hope.org", "project_news"), true);
        assert.equal(await preferences.canContact("inconnu@test.hope.org", "event_reminders"), true);
        assert.equal(await preferences.canContact("inconnu@test.hope.org", "sujet_inconnu"), false);
        assert.equal(await preferences.canContact("", "project_news"), false);
    });

    it("produit un pied de page avec un lien signe de gestion des preferences", async () => {
        const footer = await preferences.unsubscribeFooter("Ada@Test.hope.org", "project_news");
        assert.match(footer, /\/preferences\?token=/);
        assert.match(footer, /sujet=project_news/);
        const payload = tokens.verify(tokenFrom(footer), "prefs");
        assert.equal(payload.e, "ada@test.hope.org");
    });

    it("refuse un jeton falsifie, d'un autre usage ou expire", async () => {
        const valid = consentService.preferencesToken("ada@test.hope.org");
        const [body, mac] = valid.split(".");
        const forged = `${Buffer.from(JSON.stringify({ p: "prefs", e: "victime@test.hope.org" })).toString("base64url")}.${mac}`;
        assert.equal(tokens.verify(forged, "prefs"), null);
        assert.equal(tokens.verify(`${body}.${mac}x`, "prefs"), null);
        assert.equal(tokens.verify(valid, "newsletter"), null);
        const expired = tokens.sign("prefs", { e: "ada@test.hope.org" }, { ttlSeconds: -10 });
        assert.equal(tokens.verify(expired, "prefs"), null);

        const res = await request(app).get("/api/engagement/preferences").query({ token: forged });
        assert.equal(res.status, 400);
        assert.equal(res.body.code, "LINK_INVALID");
    });

    it("gere les preferences sans connexion avec le lien signe (email masque)", async () => {
        const token = consentService.preferencesToken("lecteur@test.hope.org");
        const read = await request(app).get("/api/engagement/preferences").query({ token });
        assert.equal(read.status, 200);
        assert.equal(read.body.email.includes("lecteur@"), false);
        assert.deepEqual(read.body.topics, { newsletter: false, project_news: true, donation_reminders: true, event_reminders: true });

        const update = await request(app).put("/api/engagement/preferences").send({ token, topics: { project_news: false, newsletter: true } });
        assert.equal(update.status, 200);
        assert.equal(update.body.topics.project_news, false);
        assert.equal(update.body.topics.newsletter, true);
        assert.equal(await preferences.canContact("lecteur@test.hope.org", "project_news"), false);
        assert.equal(await preferences.canContact("LECTEUR@test.hope.org", "newsletter"), true);

        const [rows] = await db.query("SELECT source, text_version FROM consents WHERE email = ? ORDER BY id", ["lecteur@test.hope.org"]);
        assert.equal(rows.length, 2);
        assert.ok(rows.every((row) => row.source === "preferences_link" && row.text_version));
    });

    it("desinscrit en un clic, d'un sujet ou de tout, et rattache la desinscription a la campagne", async () => {
        const token = consentService.preferencesToken("clic@test.hope.org", { campaignId: 42 });
        const one = await request(app).post("/api/engagement/unsubscribe").send({ token, topic: "event_reminders" });
        assert.equal(one.status, 200);
        assert.equal(one.body.topics.event_reminders, false);
        assert.equal(one.body.topics.project_news, true);

        const all = await request(app).post("/api/engagement/unsubscribe").send({ token, topic: "all" });
        assert.equal(all.status, 200);
        assert.ok(Object.values(all.body.topics).every((value) => value === false));
        const [[row]] = await db.query("SELECT COUNT(*) AS total FROM consents WHERE ref = 'campaign:42' AND granted = 0");
        assert.ok(row.total >= 3);

        const bad = await request(app).post("/api/engagement/unsubscribe").send({ token, topic: "spam" });
        assert.equal(bad.status, 422);
    });

    it("inscrit a la newsletter avec double opt-in, sans reveler si l'adresse est deja inscrite", async () => {
        const sent = [];
        const restore = mockMethods(emailService, { sendNewsletterConfirmationEmail: async (mail) => { sent.push(mail); return { sent: true }; } });
        try {
            const res = await request(app).post("/api/engagement/newsletter/subscribe").send({ email: "Abonne@Test.hope.org" });
            assert.equal(res.status, 202);
            assert.equal(sent.length, 1);
            assert.equal(sent[0].to, "abonne@test.hope.org");
            assert.equal(await preferences.canContact("abonne@test.hope.org", "newsletter"), false, "pas d'envoi avant confirmation");

            const token = tokenFrom(sent[0].confirmUrl);
            const confirm = await request(app).post("/api/engagement/newsletter/confirm").send({ token });
            assert.equal(confirm.status, 200);
            assert.equal(await preferences.canContact("abonne@test.hope.org", "newsletter"), true);

            const again = await request(app).post("/api/engagement/newsletter/subscribe").send({ email: "abonne@test.hope.org" });
            assert.equal(again.status, 202);
            assert.equal(sent.length, 1, "deja inscrit : aucun nouvel email");

            const wrongPurpose = await request(app).post("/api/engagement/newsletter/confirm").send({ token: consentService.preferencesToken("x@test.hope.org") });
            assert.equal(wrongPurpose.status, 400);
            const invalid = await request(app).post("/api/engagement/newsletter/subscribe").send({ email: "pas-un-email" });
            assert.equal(invalid.status, 422);
        } finally {
            restore();
        }
    });

    it("enregistre les cases cochees a l'inscription (newsletter par double opt-in)", async () => {
        const sent = [];
        const restore = mockMethods(emailService, { sendNewsletterConfirmationEmail: async (mail) => { sent.push(mail); return { sent: true }; } });
        try {
            const res = await client().post("/api/auth/register", {
                name: "Nina Nouvelle",
                email: "nina@test.hope.org",
                password: "Secret123",
                consents: { newsletter: true, project_news: false },
            });
            assert.equal(res.status, 201);
            assert.equal(await preferences.canContact("nina@test.hope.org", "project_news"), false);
            assert.equal(sent.length, 1);
            const [[row]] = await db.query("SELECT source, user_id FROM consents WHERE email = 'nina@test.hope.org' AND topic = 'project_news'");
            assert.equal(row.source, "register");
            assert.ok(row.user_id);

            const invalid = await client().post("/api/auth/register", {
                name: "Nina", email: "nina2@test.hope.org", password: "Secret123", consents: { newsletter: "oui" },
            });
            assert.equal(invalid.status, 422);
        } finally {
            restore();
        }
    });

    it("n'enregistre aucun consentement pour un email deja inscrit", async () => {
        const res = await client().post("/api/auth/register", {
            name: "Usurpateur", email: member.email, password: "Secret123", consents: { project_news: false },
        });
        assert.equal(res.status, 201);
        assert.equal(await preferences.canContact(member.email, "project_news"), true);
    });

    it("permet au membre connecte de gerer ses preferences", async () => {
        const http = await loginAs(member);
        const read = await http.get("/api/engagement/me/preferences");
        assert.equal(read.status, 200);
        assert.equal(read.body.topics.newsletter, false);

        const update = await http.agent.put("/api/engagement/me/preferences").set("X-Requested-With", "XMLHttpRequest")
            .send({ topics: { newsletter: true, donation_reminders: false } });
        assert.equal(update.status, 200);
        assert.equal(update.body.topics.newsletter, true);
        assert.equal(await preferences.canContact(member.email, "donation_reminders"), false);

        const anonymous = await request(app).get("/api/engagement/me/preferences");
        assert.equal(anonymous.status, 401);
    });

    it("n'envoie pas un email de sujet refuse et ajoute le pied de page sinon", async () => {
        const blocked = await emailService.sendTopicEmail({ to: member.email, subject: "Rappel", text: "Bonjour", topic: "donation_reminders" });
        assert.equal(blocked.reason, "no-consent");
        const text = await emailService.withUnsubscribeFooter({ to: member.email, text: "Bonjour", topic: "project_news" });
        assert.match(text, /^Bonjour\n/);
        assert.match(text, /preferences\?token=/);
    });

    it("ne contacte jamais un compte desactive", async () => {
        const inactive = await createUser({ email: "inactif@test.hope.org" });
        await db.query("UPDATE users SET status = 'inactive' WHERE id = ?", [inactive.id]);
        assert.equal(await preferences.canContact(inactive.email, "project_news"), false);
    });
});
