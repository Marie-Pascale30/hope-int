const { db, request, app, resetDatabase, createUser, createPayment, client, loginAs, mockMethods, PASSWORD } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const paymentService = require("../services/paymentService");
const retention = require("../services/privacyRetentionService");
const consentService = require("../services/consentService");
const { insertProject, insertEvent, hoursFromNow, lastLog } = require("./fixtures");

// Dons mensuels du compte lus en base (la facade des paiements depend d autres modules).
async function fakeSubscriptions(user) {
    const [rows] = await db.query("SELECT DISTINCT subscription_id AS id, subscription_status AS status FROM payments WHERE user_id = ? AND subscription_id IS NOT NULL", [user.id]);
    return { payments: [], subscriptions: rows };
}

describe("engagement : droits RGPD (export et effacement)", () => {
    let donor;
    let projectId;

    before(async () => {
        await resetDatabase();
        donor = await createUser({ email: "donatrice.rgpd@test.hope.org", name: "Dora Donatrice" });
        projectId = await insertProject({ title: "Puits de Bafia" });
        await createPayment({
            user_id: donor.id, status: "succeeded", donor_email: donor.email, donor_name: "Dora Donatrice", project_id: projectId,
            receipt_number: "HOPE-2026-000001", receipt_donor_name: "Dora Donatrice", receipt_donor_email: donor.email, receipt_amount: 10, receipt_currency: "eur",
        });
        // Don sans compte avec le meme email.
        await createPayment({ status: "succeeded", donor_email: "Donatrice.RGPD@test.hope.org", donor_name: "Dora D." });
        await createPayment({
            user_id: donor.id, status: "succeeded", frequency: "monthly", subscription_id: "sub_rgpd_1", subscription_status: "active",
            donor_email: donor.email,
        });
        const eventId = await insertEvent({ startAt: hoursFromNow(48) });
        await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [eventId, donor.id]);
        await db.query("INSERT INTO messages (name, email, subject, content) VALUES ('Dora', ?, 'Question', 'Mon message personnel')", [donor.email]);
        await db.query(
            "INSERT INTO applications (name, email, motivation, status, user_id) VALUES ('Dora', ?, 'Motivation detaillee', 'nouvelle', ?)",
            [donor.email, donor.id]
        );
        await consentService.applyChanges({ email: donor.email, userId: donor.id }, { newsletter: true }, { source: "account" });
        await db.query("INSERT INTO activity_logs (user_id, action, meta) VALUES (?, 'auth.login', ?)", [donor.id, JSON.stringify({ email: donor.email })]);
    });

    it("exporte toutes les donnees de la personne en JSON", async () => {
        const http = await loginAs(donor);
        const res = await http.get("/api/engagement/privacy/export");
        assert.equal(res.status, 200);
        assert.match(res.headers["content-disposition"], /attachment; filename="mes-donnees-hope-/);
        assert.equal(res.body.profile.email, donor.email);
        assert.equal(res.body.profile.password, undefined);
        assert.equal(res.body.donations.length, 3, "dons du compte et dons sans compte du meme email");
        assert.equal(res.body.eventRegistrations.length, 1);
        assert.equal(res.body.messages.length, 1);
        assert.equal(res.body.applications.length, 1);
        assert.equal(res.body.consents.length, 1);
        assert.ok(await lastLog("privacy.export"));
        assert.equal((await request(app).get("/api/engagement/privacy/export")).status, 401);
    });

    it("refuse l'effacement sans confirmation, avec un mauvais mot de passe ou pour un compte de l'equipe", async () => {
        const http = await loginAs(donor);
        assert.equal((await http.post("/api/engagement/privacy/erasure", { password: PASSWORD, confirmation: false })).status, 400);
        assert.equal((await http.post("/api/engagement/privacy/erasure", { password: "Mauvais123", confirmation: true })).status, 400);

        const staff = await createUser({ roles: ["organisatrice"] });
        const staffHttp = await loginAs(staff);
        const res = await staffHttp.post("/api/engagement/privacy/erasure", { password: PASSWORD, confirmation: true });
        assert.equal(res.status, 403);
    });

    it("n'efface rien si un don mensuel ne peut pas etre arrete", async () => {
        const restore = mockMethods(paymentService, {
            getForUser: fakeSubscriptions,
            cancelSubscription: async () => { throw new Error("Stripe indisponible"); },
        });
        try {
            const http = await loginAs(donor);
            const res = await http.post("/api/engagement/privacy/erasure", { password: PASSWORD, confirmation: true });
            assert.equal(res.status, 409);
            assert.equal(res.body.code, "SUBSCRIPTION_STOP_FAILED");
            const [[user]] = await db.query("SELECT anonymized_at FROM users WHERE id = ?", [donor.id]);
            assert.equal(user.anonymized_at, null);
        } finally {
            restore();
        }
    });

    it("anonymise le compte et les donnees, arrete les dons mensuels et conserve les recus", async () => {
        const stopped = [];
        const restore = mockMethods(paymentService, {
            getForUser: fakeSubscriptions,
            cancelSubscription: async (user, id) => { stopped.push({ user: user.id, id }); },
        });
        try {
            process.env.ACCOUNTING_RETENTION_YEARS = "6";
            const http = await loginAs(donor);
            const res = await http.post("/api/engagement/privacy/erasure", { password: PASSWORD, confirmation: true });
            assert.equal(res.status, 200, JSON.stringify(res.body));
            assert.deepEqual(stopped, [{ user: donor.id, id: "sub_rgpd_1" }]);
            assert.equal(res.body.receiptsRetained, 1);
            assert.equal(res.body.retentionYears, 6);

            const [[user]] = await db.query("SELECT name, email, phone, status, anonymized_at FROM users WHERE id = ?", [donor.id]);
            assert.equal(user.name, "Compte supprimé");
            assert.match(user.email, /@deleted\.invalid$/);
            assert.equal(user.status, "inactive");
            assert.ok(user.anonymized_at);

            const [payments] = await db.query("SELECT donor_email, donor_name, user_id, receipt_donor_name, receipt_donor_email, receipt_number FROM payments");
            assert.ok(payments.every((p) => p.donor_email === null && p.donor_name === null && p.user_id === null));
            const receipt = payments.find((p) => p.receipt_number);
            assert.equal(receipt.receipt_donor_name, "Dora Donatrice", "recu fige conserve");
            const [[retained]] = await db.query("SELECT TIMESTAMPDIFF(YEAR, CURDATE(), purge_after) AS years FROM privacy_retained_receipts");
            assert.equal(retained.years, 6);

            const [[counts]] = await db.query(
                `SELECT (SELECT COUNT(*) FROM event_registrations) AS regs, (SELECT COUNT(*) FROM consents) AS consents,
                        (SELECT content FROM messages LIMIT 1) AS message, (SELECT motivation FROM applications LIMIT 1) AS motivation`
            );
            assert.equal(counts.regs, 0);
            assert.equal(counts.consents, 0);
            assert.equal(counts.message, "[supprimé]");
            assert.equal(counts.motivation, "[supprimé]");
            const [logs] = await db.query("SELECT CAST(meta AS CHAR) AS meta FROM activity_logs");
            assert.ok(logs.every((log) => !String(log.meta || "").toLowerCase().includes("donatrice.rgpd")), "plus d'email dans le journal");
            const log = await lastLog("privacy.erasure");
            assert.equal(log.user_id, donor.id);
            assert.equal(JSON.stringify(log.meta).includes("@"), false);

            // Session fermee, plus de connexion possible.
            assert.equal((await http.get("/api/auth/me")).status, 401);
            assert.equal((await client().post("/api/auth/login", { email: donor.email, password: PASSWORD })).status, 401);
        } finally {
            delete process.env.ACCOUNTING_RETENTION_YEARS;
            restore();
        }
    });
});

describe("engagement : durees de conservation", () => {
    before(async () => {
        await resetDatabase();
    });

    after(() => db.end());

    it("purge les donnees arrivees a echeance et journalise les compteurs", async () => {
        const user = await createUser();
        await db.query(
            `INSERT INTO email_outbox (to_address, subject, body_text, attachments, status, sent_at) VALUES
             ('a@test.hope.org', 'Ancien', 'corps', '[{"filename":"r.pdf","content":"eA=="}]', 'sent', DATE_SUB(NOW(), INTERVAL 40 DAY)),
             ('b@test.hope.org', 'Recent', 'corps', NULL, 'sent', DATE_SUB(NOW(), INTERVAL 5 DAY))`
        );
        await db.query(
            `INSERT INTO activity_logs (action, meta, created_at) VALUES
             ('auth.login', ?, DATE_SUB(NOW(), INTERVAL 13 MONTH)),
             ('auth.login', ?, DATE_SUB(NOW(), INTERVAL 1 MONTH))`,
            [JSON.stringify({ email: "vieux@test.hope.org", name: "Vieux Nom", note: "contact vieux@test.hope.org", amount: 5 }), JSON.stringify({ email: "recent@test.hope.org" })]
        );
        await db.query(
            `INSERT INTO applications (name, email, motivation, status, updated_at) VALUES
             ('Refus ancien', 'r1@test.hope.org', 'm', 'refusee', DATE_SUB(NOW(), INTERVAL 25 MONTH)),
             ('Refus recent', 'r2@test.hope.org', 'm', 'refusee', DATE_SUB(NOW(), INTERVAL 2 MONTH)),
             ('Acceptee ancienne', 'r3@test.hope.org', 'm', 'acceptee', DATE_SUB(NOW(), INTERVAL 30 MONTH))`
        );
        await db.query(
            `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES
             (?, REPEAT('a', 64), DATE_SUB(NOW(), INTERVAL 3 DAY)), (?, REPEAT('b', 64), DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
            [user.id, user.id]
        );
        await db.query("INSERT INTO auth_attempts (scope, identifier, created_at) VALUES ('login', 'x', DATE_SUB(NOW(), INTERVAL 2 DAY))");
        const payment = await createPayment({ status: "succeeded", receipt_number: "HOPE-2010-000001", receipt_donor_name: "Ancien", receipt_donor_email: "ancien@test.hope.org" });
        await db.query("INSERT INTO privacy_retained_receipts (payment_id, purge_after) VALUES (?, DATE_SUB(CURDATE(), INTERVAL 1 DAY))", [payment.id]);

        const counts = await retention.runPurge();
        assert.deepEqual(counts, { outbox: 1, logs: 1, refusedApplications: 1, passwordResets: 1, authAttempts: 1, retainedReceipts: 1 });

        const [outbox] = await db.query("SELECT subject, body_text, attachments FROM email_outbox ORDER BY id");
        assert.equal(outbox[0].body_text, "");
        assert.equal(outbox[0].attachments, null);
        assert.equal(outbox[1].body_text, "corps");

        const [logs] = await db.query("SELECT meta FROM activity_logs WHERE action = 'auth.login' ORDER BY id");
        const old = typeof logs[0].meta === "string" ? JSON.parse(logs[0].meta) : logs[0].meta;
        assert.equal(old.email, "[anonymisé]");
        assert.equal(old.name, "[anonymisé]");
        assert.equal(old.note, "contact [anonymisé]");
        assert.equal(old.amount, 5);
        const recent = typeof logs[1].meta === "string" ? JSON.parse(logs[1].meta) : logs[1].meta;
        assert.equal(recent.email, "recent@test.hope.org");

        const [apps] = await db.query("SELECT name FROM applications ORDER BY id");
        assert.deepEqual(apps.map((a) => a.name), ["Refus recent", "Acceptee ancienne"]);
        const [[receipt]] = await db.query("SELECT receipt_donor_name, receipt_donor_email, receipt_number FROM payments WHERE id = ?", [payment.id]);
        assert.equal(receipt.receipt_donor_email, null);
        assert.equal(receipt.receipt_number, "HOPE-2010-000001");

        const log = await lastLog("privacy.retention_purge");
        assert.equal(log.meta.outbox, 1);

        // Deuxieme passage : rien de plus.
        const again = await retention.runPurge();
        assert.ok(Object.values(again).every((value) => value === 0));
    });
});
