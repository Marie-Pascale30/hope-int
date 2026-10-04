const { db, request, app, resetDatabase, createUser, createPayment, mockMethods, loginAs, client } = require("./helpers");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const paymentService = require("../services/paymentService");
const paymentRepo = require("../repositories/paymentRepository");
const stripeProvider = require("../services/payments/stripeProvider");
const notchpayProvider = require("../services/payments/notchpayProvider");
const flutterwaveProvider = require("../services/payments/flutterwaveProvider");

const statusOf = async (id) => (await paymentRepo.findById(id)).status;
const logsOf = async (action) => {
    const [rows] = await db.query("SELECT meta FROM activity_logs WHERE action = ? ORDER BY id", [action]);
    return rows.map((row) => (typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta));
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 50));

// Les prestataires sont simules : aucun appel externe.
let restore = [];
const mock = (target, methods) => restore.push(mockMethods(target, methods));

function notchpayWebhook(reference) {
    return request(app)
        .post("/api/payment/notchpay/webhook")
        .set("Content-Type", "application/json")
        .set("x-notch-signature", "simulee")
        .send(JSON.stringify({ type: "payment.complete", data: { reference } }));
}

function stripeEvent(type, object) {
    mock(stripeProvider, { parseWebhookEvent: async () => ({ id: "evt_test", type, data: { object } }) });
    return request(app).post("/api/payment/webhook").set("Content-Type", "application/json").send("{}");
}

describe("integrite des paiements", () => {
    before(() => resetDatabase());
    after(async () => {
        await tick();
        await db.end();
    });
    afterEach(() => {
        restore.reverse().forEach((fn) => fn());
        restore = [];
    });

    describe("C1 - paiement valide apres abandon / annulation", () => {
        it("le webhook Notch Pay valide un don annule si Notch Pay confirme le paiement", async () => {
            const payment = await createPayment({ provider: "notchpay", method: "mobile_money", currency: "xaf", amount: 5000, status: "canceled", transaction_id: "trx.np1" });
            mock(notchpayProvider, {
                isValidWebhook: () => true,
                verifyTransaction: async () => ({ reference: "trx.np1", status: "complete", amount: 5000, currency: "xaf" }),
            });
            const res = await notchpayWebhook("trx.np1");
            assert.equal(res.status, 200);
            const after = await paymentRepo.findById(payment.id);
            assert.equal(after.status, "succeeded");
            assert.match(after.receipt_number, /^HOPE-\d{4}-\d{6}$/);
        });

        it("le webhook Flutterwave valide un don echoue confirme ensuite", async () => {
            const payment = await createPayment({ provider: "flutterwave", method: "mobile_money", currency: "xaf", amount: 3000, status: "failed", transaction_id: "HOPE-fw-1" });
            mock(flutterwaveProvider, {
                isValidWebhook: () => true,
                verifyTransaction: async () => ({ txRef: "HOPE-fw-1", status: "successful", amount: 3000, currency: "xaf" }),
            });
            const res = await request(app).post("/api/payment/flutterwave/webhook").send({ data: { id: 42, tx_ref: "HOPE-fw-1" } });
            assert.equal(res.status, 200);
            assert.equal(await statusOf(payment.id), "succeeded");
        });

        it("un retour navigateur 'cancelled' ne suffit plus a annuler un don Flutterwave", async () => {
            const payment = await createPayment({ provider: "flutterwave", method: "mobile_money", currency: "xaf", amount: 3000, transaction_id: "HOPE-fw-2" });
            mock(flutterwaveProvider, {
                verifyTransaction: async () => {
                    throw Object.assign(new Error("introuvable"), { status: 502 });
                },
            });
            const res = await client().post(`/api/payment/receipts/${payment.receipt_token}/confirm`, { status: "cancelled" });
            assert.equal(res.status, 200);
            assert.equal(res.body.status, "pending");
        });

        it("le rapprochement rattrape un don annule recent paye tardivement", async () => {
            const payment = await createPayment({ status: "canceled", transaction_id: "pi_late_1" });
            mock(stripeProvider, { isEnabled: () => true, retrieveIntentStatus: async () => "succeeded" });
            const summary = await paymentService.reconcile({ id: null });
            assert.equal(await statusOf(payment.id), "succeeded");
            assert.ok(summary.recovered >= 1);
        });

        it("le rapprochement journalise chaque annulation automatique", async () => {
            const payment = await createPayment({ transaction_id: "pi_old_1" });
            await db.query("UPDATE payments SET created_at = DATE_SUB(NOW(), INTERVAL 2 DAY) WHERE id = ?", [payment.id]);
            mock(stripeProvider, { isEnabled: () => true, retrieveIntentStatus: async () => "requires_payment_method" });
            const summary = await paymentService.reconcile({ id: null });
            assert.equal(await statusOf(payment.id), "canceled");
            assert.ok(summary.abandoned >= 1);
            assert.ok((await logsOf("payment.abandoned")).some((meta) => meta.paymentId === payment.id));
        });
    });

    describe("C2 - transitions atomiques", () => {
        it("un echec concurrent n'ecrase jamais un succes", async () => {
            const payment = await createPayment();
            const stale = await paymentRepo.findById(payment.id);
            await Promise.all([
                paymentService._applyStatus(stale, "succeeded", "test"),
                paymentService._applyStatus(stale, "failed", "test"),
                paymentService._applyStatus(stale, "canceled", "test"),
            ]);
            // Quelle que soit l'ordre d'execution, un echec applique avant peut encore passer en succes.
            assert.equal(await statusOf(payment.id), "succeeded");

            // Objet perime (lu "pending") : la base refuse la transition.
            assert.equal(await paymentService._applyStatus(stale, "failed", "test"), false);
            assert.equal(await statusOf(payment.id), "succeeded");
        });

        it("updateStatus ne remplace pas un don reussi", async () => {
            const payment = await createPayment({ status: "succeeded" });
            assert.equal(await paymentRepo.updateStatus(payment.id, "failed"), false);
            assert.equal(await statusOf(payment.id), "succeeded");
        });
    });

    describe("C3 - echeances d'abonnement", () => {
        const invoice = (id) => ({
            id,
            subscription: "sub_c3",
            billing_reason: "subscription_cycle",
            amount_paid: 1500,
            currency: "eur",
            payment_intent: `pi_${id}`,
            status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
        });

        it("une facture livree deux fois en parallele ne cree qu'une echeance et un recu", async () => {
            await createPayment({ status: "succeeded", frequency: "monthly", subscription_id: "sub_c3", transaction_id: "pi_first_c3" });
            mock(stripeProvider, { parseWebhookEvent: async () => ({ id: "evt", type: "invoice.paid", data: { object: invoice("in_c3_1") } }) });
            const results = await Promise.all([
                paymentService.handleStripeWebhook("sig", Buffer.from("{}")),
                paymentService.handleStripeWebhook("sig", Buffer.from("{}")),
                paymentService.handleStripeWebhook("sig", Buffer.from("{}")),
            ]);
            assert.equal(results.length, 3);
            const [rows] = await db.query("SELECT status, receipt_number, amount FROM payments WHERE transaction_id = 'in_c3_1'");
            assert.equal(rows.length, 1);
            assert.equal(rows[0].status, "succeeded");
            assert.ok(rows[0].receipt_number);
            assert.equal(Number(rows[0].amount), 15);
        });

        it("une ancienne echeance restee en attente est validee, et relue par facture au rapprochement", async () => {
            const legacy = await createPayment({ frequency: "monthly", subscription_id: "sub_c3", transaction_id: "in_c3_legacy" });
            await db.query("UPDATE payments SET created_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?", [legacy.id]);
            let intentCalls = 0;
            mock(stripeProvider, {
                isEnabled: () => true,
                retrieveInvoiceStatus: async () => "paid",
                retrieveIntentStatus: async (id) => {
                    if (id.startsWith("in_")) intentCalls += 1;
                    return "canceled";
                },
            });
            await paymentService.reconcile({ id: null });
            assert.equal(await statusOf(legacy.id), "succeeded");
            assert.equal(intentCalls, 0);
        });

        it("l'index unique (provider, transaction_id) existe", async () => {
            await assert.rejects(
                db.query("INSERT INTO payments (amount, currency, provider, status, transaction_id, receipt_token) VALUES (1, 'eur', 'stripe', 'pending', 'in_c3_1', ?)", ["f".repeat(48)]),
                (error) => error.code === "ER_DUP_ENTRY"
            );
        });

        it("une echeance d'un projet termine est affectee au fonds general avec mention", async () => {
            const [project] = await db.query("INSERT INTO projects (title, description, status) VALUES ('Puits de Bafia', 'x', 'termine')");
            await createPayment({ status: "succeeded", frequency: "monthly", subscription_id: "sub_done", transaction_id: "pi_done", project_id: project.insertId });
            mock(stripeProvider, {
                parseWebhookEvent: async () => ({ id: "evt", type: "invoice.paid", data: { object: { ...invoice("in_done_1"), subscription: "sub_done" } } }),
            });
            await paymentService.handleStripeWebhook("sig", Buffer.from("{}"));
            const row = await paymentRepo.findByTxId("in_done_1");
            assert.equal(row.project_id, null);
            assert.equal(row.receipt_designation, null);
            assert.match(row.receipt_note, /Puits de Bafia/);
        });
    });

    describe("I1 - remboursements et litiges", () => {
        it("remboursement total : statut refunded, recu non telechargeable, journalise", async () => {
            const payment = await createPayment({ transaction_id: "pi_refund_1", amount: 20 });
            await paymentService._applyStatus(await paymentRepo.findById(payment.id), "succeeded", "test");
            const res = await stripeEvent("charge.refunded", { id: "ch_1", payment_intent: "pi_refund_1", amount_refunded: 2000, refunded: true, currency: "eur" });
            assert.equal(res.status, 200);
            const row = await paymentRepo.findById(payment.id);
            assert.equal(row.status, "refunded");
            assert.equal(row.refunded_amount, 20);
            const pdf = await request(app).get(`/api/payment/receipts/${payment.receipt_token}/pdf`);
            assert.equal(pdf.status, 400);
            assert.equal(pdf.body.code, "RECEIPT_REVOKED");
            assert.ok((await logsOf("payment.receipt_revoked")).some((meta) => meta.paymentId === payment.id));
        });

        it("remboursement partiel : reste succeeded, montant rembourse stocke et deduit des statistiques", async () => {
            await db.query("DELETE FROM payments");
            const payment = await createPayment({ transaction_id: "pi_partial", amount: 50 });
            await paymentService._applyStatus(await paymentRepo.findById(payment.id), "succeeded", "test");
            await stripeEvent("charge.refunded", { id: "ch_2", payment_intent: "pi_partial", amount_refunded: 1000, refunded: false, currency: "eur" });
            const row = await paymentRepo.findById(payment.id);
            assert.equal(row.status, "succeeded");
            assert.equal(row.refunded_amount, 10);
            assert.equal((await paymentRepo.getSummary()).totalEur, 40);
        });

        it("litige ouvert puis gagne, et litige perdu", async () => {
            const won = await createPayment({ transaction_id: "pi_dispute_won" });
            const lost = await createPayment({ transaction_id: "pi_dispute_lost" });
            for (const p of [won, lost]) await paymentService._applyStatus(await paymentRepo.findById(p.id), "succeeded", "test");
            const numberBefore = (await paymentRepo.findById(won.id)).receipt_number;

            await stripeEvent("charge.dispute.created", { id: "dp_1", payment_intent: "pi_dispute_won", status: "needs_response" });
            assert.equal(await statusOf(won.id), "disputed");
            await stripeEvent("charge.dispute.closed", { id: "dp_1", payment_intent: "pi_dispute_won", status: "won" });
            const wonRow = await paymentRepo.findById(won.id);
            assert.equal(wonRow.status, "succeeded");
            assert.equal(wonRow.receipt_number, numberBefore);

            await stripeEvent("charge.dispute.created", { id: "dp_2", payment_intent: "pi_dispute_lost", status: "needs_response" });
            await stripeEvent("charge.dispute.closed", { id: "dp_2", payment_intent: "pi_dispute_lost", status: "lost" });
            assert.equal(await statusOf(lost.id), "refunded");
        });

        it("Notch Pay : un don reussi relu 'refunded' passe en rembourse", async () => {
            const payment = await createPayment({ provider: "notchpay", method: "mobile_money", currency: "xaf", amount: 5000, transaction_id: "trx.np-refund" });
            await paymentService._applyStatus(await paymentRepo.findById(payment.id), "succeeded", "test");
            mock(notchpayProvider, {
                isValidWebhook: () => true,
                verifyTransaction: async () => ({ status: "refunded", amount: 5000, currency: "xaf" }),
            });
            assert.equal((await notchpayWebhook("trx.np-refund")).status, 200);
            assert.equal(await statusOf(payment.id), "refunded");
        });
    });

    describe("A10 - montant incoherent", () => {
        it("passe le don en review, journalise et repond 200 au prestataire", async () => {
            const payment = await createPayment({ provider: "notchpay", method: "mobile_money", currency: "xaf", amount: 5000, transaction_id: "trx.np-mismatch" });
            mock(notchpayProvider, {
                isValidWebhook: () => true,
                verifyTransaction: async () => ({ status: "complete", amount: 500, currency: "xaf" }),
            });
            const res = await notchpayWebhook("trx.np-mismatch");
            assert.equal(res.status, 200);
            assert.equal(await statusOf(payment.id), "review");
            assert.ok((await logsOf("payment.amount_mismatch")).some((meta) => meta.paymentId === payment.id));
            const pdf = await request(app).get(`/api/payment/receipts/${payment.receipt_token}/pdf`);
            assert.equal(pdf.body.code, "PAYMENT_UNDER_REVIEW");
        });
    });

    describe("A4 - abonnements", () => {
        it("le statut d'abonnement suit les webhooks et getForUser le lit en base", async () => {
            const user = await createUser();
            await createPayment({ user_id: user.id, status: "succeeded", frequency: "monthly", subscription_id: "sub_a4", subscription_status: "active", transaction_id: "pi_a4" });
            mock(stripeProvider, {
                getSubscriptionStatus: async () => {
                    throw new Error("Stripe ne doit pas etre appele");
                },
            });
            await stripeEvent("customer.subscription.updated", { id: "sub_a4", status: "past_due" });
            let mine = await paymentService.getForUser(user);
            assert.equal(mine.subscriptions[0].status, "past_due");

            await stripeEvent("customer.subscription.deleted", { id: "sub_a4", status: "canceled" });
            mine = await paymentService.getForUser(user);
            assert.equal(mine.subscriptions[0].status, "canceled");
        });

        it("invoice.payment_failed marque l'abonnement en retard de paiement", async () => {
            await createPayment({ status: "succeeded", frequency: "monthly", subscription_id: "sub_fail", subscription_status: "active", transaction_id: "pi_sub_fail" });
            await stripeEvent("invoice.payment_failed", { id: "in_fail", subscription: "sub_fail", billing_reason: "subscription_cycle" });
            assert.equal((await paymentRepo.findFirstBySubscription("sub_fail")).subscription_status, "past_due");
        });

        it("arrete un don mensuel avec le jeton de recu, sans compte", async () => {
            const payment = await createPayment({ status: "succeeded", frequency: "monthly", subscription_id: "sub_token", subscription_status: "active", transaction_id: "pi_sub_token" });
            const canceled = [];
            mock(stripeProvider, { cancelSubscription: async (id) => canceled.push(id) });

            const res = await client().post(`/api/payment/receipts/${payment.receipt_token}/cancel-subscription`, {});
            assert.equal(res.status, 200);
            assert.deepEqual(canceled, ["sub_token"]);
            assert.equal((await paymentRepo.findById(payment.id)).subscription_status, "canceled");

            const again = await client().post(`/api/payment/receipts/${payment.receipt_token}/cancel-subscription`, {});
            assert.equal(again.body.alreadyCanceled, true);
            assert.equal(canceled.length, 1);
        });

        it("refuse l'arret par jeton pour un don ponctuel ou un jeton invalide", async () => {
            const payment = await createPayment({ status: "succeeded" });
            const res = await client().post(`/api/payment/receipts/${payment.receipt_token}/cancel-subscription`, {});
            assert.equal(res.status, 400);
            assert.equal((await client().post("/api/payment/receipts/abc/cancel-subscription", {})).status, 422);
        });

        it("exige l'en-tete CSRF quand la requete porte un cookie de session", async () => {
            const user = await createUser();
            const http = await loginAs(user);
            const payment = await createPayment({ status: "succeeded", frequency: "monthly", subscription_id: "sub_csrf", transaction_id: "pi_csrf" });
            const res = await http.agent.post(`/api/payment/receipts/${payment.receipt_token}/cancel-subscription`).send({});
            assert.equal(res.status, 403);
        });
    });

    describe("I4 - export", () => {
        it("getForExport renvoie tout, en ordre chronologique, avec les memes filtres", async () => {
            const rows = await paymentRepo.getForExport({ provider: "stripe" });
            assert.ok(rows.length > 0);
            assert.ok(rows.every((row) => row.provider === "stripe"));
            const dates = rows.map((row) => new Date(row.paid_at || row.created_at).getTime());
            assert.deepEqual(dates, [...dates].sort((a, b) => a - b));
            assert.equal(rows.length, (await paymentRepo.getAll({ provider: "stripe" })).length);
        });
    });
});
