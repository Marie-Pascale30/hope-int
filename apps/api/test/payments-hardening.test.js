const {
    db, request, app, resetDatabase, createUser, createPayment, mockMethods, loginAs, client, insertEvent, hoursFromNow, lastLog,
} = require("./fixtures");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const paymentService = require("../services/paymentService");
const paymentRepo = require("../repositories/paymentRepository");
const reconcileService = require("../services/payments/reconcileService");
const stripeProvider = require("../services/payments/stripeProvider");
const flutterwaveProvider = require("../services/payments/flutterwaveProvider");

const tick = () => new Promise((resolve) => setTimeout(resolve, 50));
const seconds = (iso) => Math.floor(new Date(iso).getTime() / 1000);

let restore = [];
const mock = (target, methods) => restore.push(mockMethods(target, methods));

function stripeEvent(type, object, extra = {}) {
    mock(stripeProvider, { parseWebhookEvent: async () => ({ id: "evt_test", type, data: { object }, ...extra }) });
    return request(app).post("/api/payment/webhook").set("Content-Type", "application/json").send("{}");
}

describe("paiements : abonnements, dates prestataire, bilans et rapprochement planifie", () => {
    let member, memberHttp, financeHttp;

    before(async () => {
        await resetDatabase();
        member = await createUser();
        memberHttp = await loginAs(member);
        financeHttp = await loginAs(await createUser({ roles: ["responsable_finance"] }));
    });

    afterEach(() => {
        restore.reverse().forEach((fn) => fn());
        restore = [];
    });

    after(async () => {
        await tick();
        await db.end();
    });

    describe("dons mensuels", () => {
        it("un abonnement annule ne redevient jamais actif", async () => {
            await createPayment({ user_id: member.id, status: "succeeded", frequency: "monthly", subscription_id: "sub_final", subscription_status: "canceled" });
            await stripeEvent("customer.subscription.updated", { id: "sub_final", status: "active" });
            assert.equal(await paymentRepo.setSubscriptionStatus("sub_final", "past_due"), false);
            assert.equal((await paymentRepo.findFirstBySubscription("sub_final")).subscription_status, "canceled");
        });

        it("renvoie la prochaine echeance tenue a jour par les webhooks", async () => {
            await createPayment({ user_id: member.id, status: "succeeded", frequency: "monthly", subscription_id: "sub_next", subscription_status: "active" });
            await stripeEvent("customer.subscription.updated", {
                id: "sub_next", status: "active", items: { data: [{ current_period_end: seconds("2026-11-05T10:00:00Z") }] },
            });
            let mine = (await memberHttp.get("/api/payment/mine")).body;
            assert.equal(mine.subscriptions.find((s) => s.id === "sub_next").next_payment_at, "2026-11-05T10:00:00.000Z");

            await stripeEvent("invoice.paid", {
                id: "in_next_1", subscription: "sub_next", billing_reason: "subscription_create",
                lines: { data: [{ period: { end: seconds("2026-12-05T10:00:00Z") } }] },
            });
            mine = (await memberHttp.get("/api/payment/mine")).body;
            assert.equal(mine.subscriptions.find((s) => s.id === "sub_next").next_payment_at, "2026-12-05T10:00:00.000Z");
            assert.equal(mine.subscriptions.find((s) => s.id === "sub_final").next_payment_at, null, "abonnement annule : pas d'echeance");
        });

        it("relit une seule fois chez Stripe un ancien abonnement sans statut", async () => {
            const user = await createUser();
            await createPayment({ user_id: user.id, status: "succeeded", frequency: "monthly", subscription_id: "sub_legacy" });
            let calls = 0;
            mock(stripeProvider, {
                isEnabled: () => true,
                getSubscriptionStatus: async () => {
                    calls += 1;
                    return { status: "active", currentPeriodEnd: new Date("2026-11-20T00:00:00Z") };
                },
            });
            const first = await paymentService.getForUser(user);
            const second = await paymentService.getForUser(user);
            assert.equal(calls, 1);
            assert.equal(first.subscriptions[0].next_payment_at, "2026-11-20T00:00:00.000Z");
            assert.deepEqual(second.subscriptions, first.subscriptions);
        });

        it("DELETE /payment/subscriptions/:id arrete le don, meme deja supprime chez Stripe", async () => {
            await createPayment({ user_id: member.id, status: "succeeded", frequency: "monthly", subscription_id: "sub_gone", subscription_status: "active" });
            mock(stripeProvider, {
                cancelSubscription: async () => {
                    throw Object.assign(new Error("No such subscription"), { code: "resource_missing" });
                },
            });
            const res = await memberHttp.delete("/api/payment/subscriptions/sub_gone");
            assert.equal(res.status, 200);
            assert.equal((await paymentRepo.findFirstBySubscription("sub_gone")).subscription_status, "canceled");
            assert.equal((await lastLog("payment.subscription_canceled")).meta.alreadyDeletedAtProvider, true);
        });

        it("DELETE /payment/subscriptions/:id : propriete, format et erreurs Stripe", async () => {
            const canceled = [];
            mock(stripeProvider, { cancelSubscription: async (id) => canceled.push(id) });
            await createPayment({ user_id: member.id, status: "succeeded", frequency: "monthly", subscription_id: "sub_mine", subscription_status: "active" });
            await createPayment({ status: "succeeded", frequency: "monthly", subscription_id: "sub_other", subscription_status: "active" });

            assert.equal((await memberHttp.delete("/api/payment/subscriptions/sub_other")).status, 404);
            assert.equal((await memberHttp.delete("/api/payment/subscriptions/pas-un-id")).status, 422);
            assert.equal((await request(app).delete("/api/payment/subscriptions/sub_mine")).status, 401);
            assert.equal((await memberHttp.delete("/api/payment/subscriptions/sub_mine")).status, 200);
            assert.deepEqual(canceled, ["sub_mine"]);

            await createPayment({ user_id: member.id, status: "succeeded", frequency: "monthly", subscription_id: "sub_down", subscription_status: "active" });
            restore.reverse().forEach((fn) => fn());
            restore = [];
            mock(stripeProvider, {
                cancelSubscription: async () => {
                    throw Object.assign(new Error("Stripe indisponible"), { status: 502 });
                },
            });
            assert.equal((await memberHttp.delete("/api/payment/subscriptions/sub_down")).status, 502);
            assert.equal((await paymentRepo.findFirstBySubscription("sub_down")).subscription_status, "active");
        });
    });

    describe("date reelle du paiement", () => {
        it("retient la date Stripe pour l'annee du recu", async () => {
            // 31/12/2025 22:30 UTC = 23:30 a Douala : recu de 2025 meme confirme en 2026.
            const payment = await createPayment({ transaction_id: "pi_late_year" });
            mock(stripeProvider, { retrieveIntent: async () => ({ status: "succeeded", paidAt: new Date("2025-12-31T22:30:00Z") }) });
            const res = await client().post(`/api/payment/receipts/${payment.receipt_token}/confirm`, {});
            assert.equal(res.status, 200);
            const row = await paymentRepo.findById(payment.id);
            assert.equal(row.status, "succeeded");
            assert.equal(new Date(row.paid_at).toISOString(), "2025-12-31T22:30:00.000Z");
            assert.match(row.receipt_number, /^HOPE-2025-/);
        });

        it("retient la date de l'evenement Stripe payment_intent.succeeded", async () => {
            const payment = await createPayment({ transaction_id: "pi_event_date" });
            await stripeEvent("payment_intent.succeeded", { id: "pi_event_date" }, { created: seconds("2026-03-01T08:00:00Z") });
            assert.equal(new Date((await paymentRepo.findById(payment.id)).paid_at).toISOString(), "2026-03-01T08:00:00.000Z");
        });

        it("retient la date de transaction Flutterwave et ignore une date future", async () => {
            const payment = await createPayment({ provider: "flutterwave", method: "mobile_money", currency: "xaf", amount: 2000, transaction_id: "HOPE-fw-date" });
            mock(flutterwaveProvider, {
                isValidWebhook: () => true,
                verifyTransaction: async () => ({ txRef: "HOPE-fw-date", status: "successful", amount: 2000, currency: "xaf", paidAt: "2026-02-10T09:00:00.000Z" }),
            });
            await request(app).post("/api/payment/flutterwave/webhook").send({ data: { id: 7, tx_ref: "HOPE-fw-date" } });
            assert.equal(new Date((await paymentRepo.findById(payment.id)).paid_at).toISOString(), "2026-02-10T09:00:00.000Z");

            const future = await createPayment({ transaction_id: "pi_future" });
            mock(stripeProvider, { retrieveIntent: async () => ({ status: "succeeded", paidAt: new Date(Date.now() + 86400000) }) });
            await client().post(`/api/payment/receipts/${future.receipt_token}/confirm`, {});
            const paidAt = new Date((await paymentRepo.findById(future.id)).paid_at).getTime();
            assert.ok(Math.abs(paidAt - Date.now()) < 60000, "date future ignoree : date de confirmation");
        });
    });

    describe("bilan dans le fuseau des recus", () => {
        it("compte l'annee et les mois selon RECEIPT_TIMEZONE (Africa/Douala)", async () => {
            await db.query("DELETE FROM payments");
            // 31/12/2025 23:30 UTC = 01/01/2026 00:30 a Douala.
            await createPayment({ status: "succeeded", amount: 10, paid_at: new Date("2025-12-31T23:30:00Z") });
            await createPayment({ status: "succeeded", amount: 20, paid_at: new Date("2026-06-15T12:00:00Z") });
            // 31/12/2026 23:30 UTC = 2027 a Douala.
            await createPayment({ status: "succeeded", amount: 40, paid_at: new Date("2026-12-31T23:30:00Z") });

            const res = await financeHttp.get("/api/admin/finance/summary?year=2026");
            assert.equal(res.status, 200);
            assert.equal(res.body.totalEur, 30);
            assert.deepEqual(res.body.byMonth.map((m) => [m.month, m.amountEur]), [["2026-01", 10], ["2026-06", 20]]);
            assert.equal((await financeHttp.get("/api/admin/finance/summary?year=2027")).body.totalEur, 40);

            const all = await paymentRepo.getSummary();
            assert.deepEqual(all.byMonth.map((m) => m.month), ["2026-01", "2026-06", "2027-01"]);
        });

        it("la migration 004 renseigne paid_at des anciens dons confirmes", async () => {
            const legacy = await createPayment({ status: "succeeded" });
            await require("../migrations/004_hardening").up({ db });
            assert.ok((await paymentRepo.findById(legacy.id)).paid_at);
        });
    });

    describe("rapprochement planifie", () => {
        it("ne demarre pas de worker pendant les tests", () => {
            assert.equal(reconcileService.start(), false);
        });

        it("une execution du worker est journalisee et consultable", async () => {
            await reconcileService.tick();
            const lastRun = await paymentService.getLastReconcile();
            assert.equal(lastRun.source, "worker");
            assert.ok(Date.now() - new Date(lastRun.at).getTime() < 60000);
            assert.equal((await lastLog("finance.reconcile")).meta.source, "worker");
            await reconcileService.stop();
        });

        it("saute l'execution si une autre instance detient le verrou", async () => {
            const [[before]] = await db.query("SELECT COUNT(*) AS total FROM activity_logs WHERE action = 'finance.reconcile'");
            const connection = await db.getConnection();
            try {
                await connection.query("SELECT GET_LOCK('hope_payments_reconcile', 0)");
                await reconcileService.tick();
            } finally {
                await connection.query("SELECT RELEASE_LOCK('hope_payments_reconcile')");
                connection.release();
            }
            const [[after]] = await db.query("SELECT COUNT(*) AS total FROM activity_logs WHERE action = 'finance.reconcile'");
            assert.equal(after.total, before.total);
        });
    });

    describe("evenements du membre", () => {
        it("GET /events/mine et regles d'inscription (complet, deja inscrit, commence, non publie)", async () => {
            const open = await insertEvent({ title: "Atelier", startAt: hoursFromNow(48) });
            await db.query("UPDATE events SET capacity = 1 WHERE id = ?", [open]);
            const started = await insertEvent({ title: "Deja commence", startAt: hoursFromNow(-1), endAt: hoursFromNow(3) });
            const hidden = await insertEvent({ title: "Brouillon", startAt: hoursFromNow(48), published: 0 });

            assert.equal((await memberHttp.post(`/api/events/${open}/registration`)).status, 201);
            assert.equal((await memberHttp.post(`/api/events/${open}/registration`)).status, 409);
            const other = await loginAs(await createUser());
            const full = await other.post(`/api/events/${open}/registration`);
            assert.equal(full.status, 409);
            assert.equal(full.body.error, "Cet événement est complet");
            assert.equal((await memberHttp.post(`/api/events/${started}/registration`)).status, 400);
            assert.equal((await memberHttp.post(`/api/events/${hidden}/registration`)).status, 404);
            assert.equal((await memberHttp.post("/api/events/999999/registration")).status, 404);

            const mine = await memberHttp.get("/api/events/mine");
            assert.equal(mine.status, 200);
            assert.deepEqual(mine.body.map((event) => event.title), ["Atelier"]);
            assert.equal(mine.body[0].remaining_spots, 0);
            assert.equal((await request(app).get("/api/events/mine")).status, 401);
        });
    });
});
