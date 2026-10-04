const { db, resetDatabase, createPayment } = require("./helpers");
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const emailService = require("../services/emailService");
const emailOutbox = require("../services/emailOutbox");
const transport = require("../services/emailTransport");
const paymentRepo = require("../repositories/paymentRepository");

const SMTP_ENV = { SMTP_HOST: "smtp.test.local", SMTP_PORT: "587", SMTP_USER: "robot", SMTP_PASS: "secret" };
const saved = {};

// Transport SMTP simule : enregistre les envois, echoue si fail > 0.
const fake = { sent: [], fail: 0, delayMs: 0 };
transport.setTransporterForTests({
    sendMail: async (message) => {
        if (fake.delayMs) await new Promise((resolve) => setTimeout(resolve, fake.delayMs));
        if (fake.fail > 0) {
            fake.fail -= 1;
            throw new Error("connexion SMTP refusée");
        }
        fake.sent.push(message);
    },
});

const outboxRows = async () => (await db.query("SELECT * FROM email_outbox ORDER BY id"))[0];
const makeDue = () => db.query("UPDATE email_outbox SET next_attempt_at = NOW() - INTERVAL 1 SECOND WHERE status = 'pending'");

describe("file d'envoi des emails", () => {
    before(() => resetDatabase());
    after(() => {
        Object.assign(process.env, saved);
        return db.end();
    });
    beforeEach(async () => {
        fake.sent = [];
        fake.fail = 0;
        fake.delayMs = 0;
        await db.query("DELETE FROM email_outbox");
    });

    it("sans SMTP : comportement inchange, rien n'est mis en file", async () => {
        const result = await emailService.sendApplicationReceivedEmail({ to: "a@test.hope.org", fullName: "Ada" });
        assert.equal(result.sent, false);
        assert.equal(result.reason, "smtp-not-configured");
        assert.equal((await outboxRows()).length, 0);
        assert.deepEqual(await emailOutbox.processBatch(), { sent: 0, retry: 0, failed: 0 });
    });

    it("le worker ne demarre pas pendant les tests", () => {
        assert.equal(emailOutbox.start(), false);
    });

    describe("avec SMTP configure", () => {
        before(() => {
            for (const [key, value] of Object.entries(SMTP_ENV)) {
                saved[key] = process.env[key];
                process.env[key] = value;
            }
        });

        it("met le recu en file puis l'envoie une seule fois et renseigne receipt_sent_at", async () => {
            const payment = await createPayment({ status: "succeeded", receipt_number: "HOPE-2026-900001" });
            const result = await emailService.sendDonationReceiptEmail({
                to: "ada@test.hope.org",
                fullName: "Ada",
                amountLabel: "10,00 €",
                receiptNumber: "HOPE-2026-900001",
                receiptUrl: "http://x",
                pdfBuffer: Buffer.from("%PDF-test"),
                paymentId: payment.id,
            });
            assert.deepEqual(result, { sent: true, queued: true });
            assert.equal(fake.sent.length, 0);

            // Deux workers concurrents (deux instances) : un seul envoi.
            await Promise.all([emailOutbox.processBatch(), emailOutbox.processBatch(), emailOutbox.processBatch()]);
            assert.equal(fake.sent.length, 1);
            assert.equal(fake.sent[0].attachments[0].content.toString(), "%PDF-test");
            const [row] = await outboxRows();
            assert.equal(row.status, "sent");
            assert.ok((await paymentRepo.findById(payment.id)).receipt_sent_at);
        });

        it("reessaie avec backoff puis abandonne apres le nombre maximal de tentatives", async () => {
            await emailService.sendPasswordResetEmail({ to: "b@test.hope.org", fullName: "Brice", resetUrl: "http://reset/secret-token" });
            await db.query("UPDATE email_outbox SET max_attempts = 2");
            fake.fail = 5;

            assert.equal((await emailOutbox.processBatch()).retry, 1);
            let [row] = await outboxRows();
            assert.equal(row.status, "pending");
            assert.equal(row.attempts, 1);
            assert.ok(new Date(row.next_attempt_at) > new Date());
            // Pas encore du : rien n'est retente.
            assert.equal((await emailOutbox.processBatch()).retry, 0);

            await makeDue();
            assert.equal((await emailOutbox.processBatch()).failed, 1);
            [row] = await outboxRows();
            assert.equal(row.status, "failed");
            assert.match(row.last_error, /SMTP/);
            // Contenu sensible efface.
            assert.equal(row.body_text, "");
            assert.equal(fake.sent.length, 0);
            assert.equal(emailOutbox.retryDelay(1), 30);
            assert.equal(emailOutbox.retryDelay(3), 120);
        });

        it("identifiants : envoi immediat ; en cas d'echec sent=false (mot de passe montre a l'admin)", async () => {
            const ok = await emailService.sendNewCredentialsEmail({ to: "c@test.hope.org", fullName: "Kevin", password: "Provisoire1", loginUrl: "http://x" });
            assert.deepEqual(ok, { sent: true, queued: true });
            assert.equal(fake.sent.length, 1);

            fake.fail = 1;
            const ko = await emailService.sendNewCredentialsEmail({ to: "d@test.hope.org", fullName: "Sandrine", password: "Provisoire2", loginUrl: "http://x" });
            assert.equal(ko.sent, false);
            assert.equal(ko.reason, "smtp-error");
            const rows = await outboxRows();
            assert.deepEqual(rows.map((row) => row.status), ["sent", "failed"]);
            assert.ok(rows.every((row) => row.body_text === ""));
            // Jamais renvoye plus tard par le worker.
            await makeDue();
            await emailOutbox.processBatch();
            assert.equal(fake.sent.length, 1);
        });

        it("un message reserve par une instance n'est pas repris avant expiration du verrou", async () => {
            await emailService.sendApplicationReceivedEmail({ to: "e@test.hope.org", fullName: "Eve" });
            await db.query("UPDATE email_outbox SET locked_until = NOW() + INTERVAL 1 MINUTE, claimed_by = 'autre-instance'");
            assert.equal((await emailOutbox.processBatch()).sent, 0);
            await db.query("UPDATE email_outbox SET locked_until = NOW() - INTERVAL 1 SECOND");
            assert.equal((await emailOutbox.processBatch()).sent, 1);
        });
    });
});
