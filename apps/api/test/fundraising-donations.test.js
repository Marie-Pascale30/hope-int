const { db, resetDatabase, createPayment, mockMethods, client } = require("./helpers");
const { insertProject } = require("./fixtures");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const paymentRepo = require("../repositories/paymentRepository");
const notchpayProvider = require("../services/payments/notchpayProvider");
const emailService = require("../services/emailService");
const preferences = require("../services/preferences");
const receiptFormat = require("../services/receiptFormat");
const { applyStatus } = require("../services/payments/statusService");
const reminderService = require("../services/donationReminderService");
const tributeService = require("../services/donationTributeService");
const { cleanSource } = require("@hope/shared/fundraising");
const { parseTribute } = require("../services/donationExtras");

let restore = [];
const mock = (target, methods) => restore.push(mockMethods(target, methods));
const tick = () => new Promise((resolve) => setTimeout(resolve, 80));
let sent = [];

function mockMobileMoney() {
    mock(notchpayProvider, {
        isEnabled: () => true,
        createPaymentLink: async () => ({ transactionId: `trx.${Date.now()}.${Math.random()}`, redirectUrl: "https://pay.example/x" }),
    });
}

const donate = (body) => client().post("/api/payment/donations", {
    amount: 5000, provider: "mobile_money", donorName: "Ada Lovelace", donorEmail: "ada@test.hope.org", phone: "+237690000000", ...body,
});

describe("collecte : source, hommage et relances", () => {
    before(() => resetDatabase());
    after(async () => {
        await tick();
        await db.end();
    });
    afterEach(() => {
        restore.reverse().forEach((fn) => fn());
        restore = [];
        sent = [];
    });

    const captureEmails = () => mock(emailService, { send: async (message) => { sent.push(message); return { sent: true }; } });

    describe("source du don", () => {
        it("nettoie la source (60 caracteres, minuscules, sans accents)", () => {
            assert.equal(cleanSource("  Partage WhatsApp Été!! "), "partage-whatsapp-ete");
            assert.equal(cleanSource("<script>alert(1)</script>"), "script-alert-1-script");
            assert.equal(cleanSource("a".repeat(100)).length, 60);
            assert.equal(cleanSource("!!!"), null);
            assert.equal(cleanSource(42), null);
        });

        it("enregistre la source nettoyee sur le don", async () => {
            mockMobileMoney();
            const res = await donate({ source: "Newsletter Mars 2026" });
            assert.equal(res.status, 201);
            const payment = await paymentRepo.findById(res.body.paymentId);
            assert.equal(payment.source, "newsletter-mars-2026");
        });

        it("refuse une source trop longue (422)", async () => {
            const res = await donate({ source: "x".repeat(201) });
            assert.equal(res.status, 422);
        });
    });

    describe("dons en hommage", () => {
        it("refuse un nom vide ou un type inconnu", async () => {
            mockMobileMoney();
            assert.equal((await donate({ tributeType: "birthday", tributeName: "Marie" })).status, 422);
            assert.equal((await donate({ tributeType: "honor", tributeName: " " })).status, 400);
            assert.equal((await donate({ tributeType: "honor", tributeName: "Marie", tributeMessage: "x".repeat(301) })).status, 422);
        });

        it("neutralise balises, retours a la ligne du nom et liens du message", () => {
            const tribute = parseTribute({
                tributeType: "memory",
                tributeName: "Jean\r\nBcc: pirate@x.org <b>",
                tributeMessage: "Repose en paix\n\n\n\nvoir https://phishing.example/login <img>",
            });
            assert.equal(tribute.tributeName.includes("\n"), false);
            assert.equal(/[<>]/.test(tribute.tributeName), false);
            assert.match(tribute.tributeMessage, /\[lien retiré\]/);
            assert.equal(tribute.tributeMessage.includes("https://"), false);
            assert.equal(tribute.tributeMessage.includes("\n\n\n"), false);
        });

        it("fige la mention sur le recu et envoie l'e-carte une seule fois, sans le montant", async () => {
            mockMobileMoney();
            captureEmails();
            const res = await donate({
                amount: 7000,
                tributeType: "memory",
                tributeName: "Grand-mère Odile",
                tributeEmail: "famille@test.hope.org",
                tributeMessage: "Une pensée pour elle.",
            });
            assert.equal(res.status, 201);
            const created = await paymentRepo.findById(res.body.paymentId);
            assert.equal(created.tribute_type, "memory");

            await applyStatus(created, "succeeded", "test");
            for (let i = 0; i < 40 && !(await paymentRepo.findById(created.id)).tribute_notified_at; i += 1) await tick();
            await tick();
            const payment = await paymentRepo.findById(created.id);
            assert.equal(payment.receipt_tribute, "À la mémoire de Grand-mère Odile");
            assert.equal(receiptFormat.receiptView(payment).tribute, "À la mémoire de Grand-mère Odile");
            assert.ok(payment.tribute_notified_at);

            const cards = sent.filter((message) => message.to === "famille@test.hope.org");
            assert.equal(cards.length, 1);
            assert.match(cards[0].text, /Ada Lovelace/);
            assert.match(cards[0].text, /Une pensée pour elle/);
            assert.equal(/7\s?000/.test(cards[0].text), false, "le montant n'apparait pas");

            // Nouvel appel (renvoi du recu) : pas de seconde e-carte.
            assert.equal(await tributeService.notify(created.id), false);
        });
    });

    describe("relance des paiements abandonnes", () => {
        const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000);

        it("relance a 2 h puis a 24 h au plus, avec un lien qui pre-remplit le don", async () => {
            captureEmails();
            const projectId = await insertProject({ title: "Puits de Bafia" });
            const payment = await createPayment({
                status: "failed", amount: 25, donor_email: "relance@test.hope.org", project_id: projectId, created_at: ago(3),
            });

            let summary = await reminderService.run();
            assert.equal(summary.sent, 1, JSON.stringify(sent.map((m) => m.to)));
            assert.equal(sent.length, 1);
            assert.match(sent[0].text, /Reprendre mon don : .*\/don\?montant=25&devise=eur&moyen=card&ref=relance&projet=\d+/);
            assert.equal((await paymentRepo.findById(payment.id)).reminder_count, 1);

            // Rien de plus tant que 24 h ne sont pas passees.
            summary = await reminderService.run();
            assert.equal(summary.sent, 0);

            await db.query("UPDATE payments SET created_at = ?, reminder_sent_at = ? WHERE id = ?", [ago(25), ago(23), payment.id]);
            summary = await reminderService.run();
            assert.equal(summary.sent, 1);
            assert.match(sent[1].text, /dernier message/);
            assert.equal((await paymentRepo.findById(payment.id)).reminder_count, 2);

            await db.query("UPDATE payments SET created_at = ?, reminder_sent_at = ? WHERE id = ?", [ago(60), ago(40), payment.id]);
            assert.equal((await reminderService.run()).sent, 0, "jamais de troisieme relance");
        });

        it("ne relance pas un donateur qui a donne depuis, ni sans consentement, ni un don recent", async () => {
            captureEmails();
            await createPayment({ status: "canceled", donor_email: "fidele@test.hope.org", created_at: ago(4) });
            await createPayment({ status: "succeeded", donor_email: "FIDELE@test.hope.org", created_at: ago(3) });
            await createPayment({ status: "failed", donor_email: "recent@test.hope.org", created_at: ago(1) });
            const refused = await createPayment({ status: "failed", donor_email: "non@test.hope.org", created_at: ago(5) });
            await createPayment({ status: "failed", provider: "offline", method: "cash", donor_email: "hl@test.hope.org", created_at: ago(5) });
            mock(preferences, { canContact: async (email) => email !== "non@test.hope.org" });

            const summary = await reminderService.run();
            assert.equal(summary.sent, 0);
            assert.equal(sent.length, 0);
            // Le refus de consentement consomme la relance (aucun nouvel essai).
            assert.equal((await paymentRepo.findById(refused.id)).reminder_count, 1);
        });
    });
});
