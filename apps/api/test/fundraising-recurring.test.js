const { db, request, app, resetDatabase, createUser, createPayment, loginAs, client, mockMethods } = require("./helpers");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const stripeProvider = require("../services/payments/stripeProvider");
const emailService = require("../services/emailService");
const preferences = require("../services/preferences");
const annualService = require("../services/donationAnnualService");
const paymentRepo = require("../repositories/paymentRepository");
const { receiptYear } = require("../services/receiptFormat");

let restore = [];
const mock = (target, methods) => restore.push(mockMethods(target, methods));
let sent = [];
const tick = () => new Promise((resolve) => setTimeout(resolve, 80));

function stripeEvent(type, object) {
    mock(stripeProvider, { parseWebhookEvent: async () => ({ id: "evt_test", type, data: { object } }) });
    return request(app).post("/api/payment/webhook").set("Content-Type", "application/json").send("{}");
}

describe("dons mensuels Stripe, indicateurs et recapitulatifs annuels", () => {
    let finance;
    let original;

    before(async () => {
        await resetDatabase();
        finance = await loginAs(await createUser({ roles: ["responsable_finance"] }));
        original = await createPayment({
            status: "succeeded", amount: 20, frequency: "monthly", subscription_id: "sub_dun1", subscription_status: "active",
            donor_name: "Bea Mensuelle", donor_email: "bea@test.hope.org", paid_at: new Date(),
        });
        await createPayment({ status: "succeeded", amount: 10, frequency: "monthly", subscription_id: "sub_ok2", subscription_status: "active", paid_at: new Date() });
        await createPayment({ status: "succeeded", amount: 6559.57, currency: "xaf", method: "mobile_money", provider: "notchpay", frequency: "monthly", subscription_id: "sub_xaf3", subscription_status: "active", paid_at: new Date() });
        await createPayment({ status: "succeeded", amount: 30, frequency: "monthly", subscription_id: "sub_gone4", subscription_status: "active", paid_at: new Date() });
    });
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

    it("invoice.payment_failed : email unique au donateur avec lien de mise a jour de la carte", async () => {
        captureEmails();
        const invoice = { id: "in_fail_1", billing_reason: "subscription_cycle", subscription: "sub_dun1", attempt_count: 1 };
        assert.equal((await stripeEvent("invoice.payment_failed", invoice)).status, 200);
        assert.equal((await paymentRepo.findById(original.id)).subscription_status, "past_due");
        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, "bea@test.hope.org");
        assert.match(sent[0].text, new RegExp(`/don/merci\\?ref=${original.receipt_token}&carte=1`));

        // Evenement rejoue : pas de second email.
        await stripeEvent("invoice.payment_failed", invoice);
        assert.equal(sent.length, 1);
    });

    it("respecte le consentement pour la relance de carte", async () => {
        captureEmails();
        mock(preferences, { canContact: async () => false });
        await stripeEvent("invoice.payment_failed", { id: "in_fail_2", billing_reason: "subscription_cycle", subscription: "sub_dun1" });
        assert.equal(sent.length, 0);
    });

    it("portail de facturation : par jeton de recu (Stripe simule), refus d'un don ponctuel", async () => {
        let asked = null;
        mock(stripeProvider, {
            createBillingPortalSession: async (input) => {
                asked = input;
                return { url: "https://billing.stripe.com/p/session/test" };
            },
        });
        const res = await client().post("/api/fundraising/subscriptions/portal", { token: original.receipt_token });
        assert.equal(res.status, 200);
        assert.equal(res.body.url, "https://billing.stripe.com/p/session/test");
        assert.equal(asked.subscriptionId, "sub_dun1");

        const once = await createPayment({ status: "succeeded" });
        assert.equal((await client().post("/api/fundraising/subscriptions/portal", { token: once.receipt_token })).status, 400);
        assert.equal((await client().post("/api/fundraising/subscriptions/portal", { subscriptionId: "sub_dun1" })).status, 401);
    });

    it("MRR, attrition et ventilation par source dans les indicateurs Finance", async () => {
        await db.query("UPDATE payments SET source = 'partage-whatsapp' WHERE subscription_id = 'sub_ok2'");
        await stripeEvent("customer.subscription.deleted", { id: "sub_gone4" });
        assert.ok((await paymentRepo.findById((await paymentRepo.findFirstBySubscription("sub_gone4")).id)).subscription_ended_at);

        const member = await loginAs(await createUser());
        assert.equal((await member.get("/api/fundraising/admin/insights")).status, 403);

        const res = await finance.get("/api/fundraising/admin/insights");
        assert.equal(res.status, 200);
        const { recurring, bySource } = res.body;
        assert.equal(recurring.active, 3);
        assert.equal(recurring.pastDue, 1);
        assert.equal(recurring.canceledLast30, 1);
        assert.equal(recurring.mrrEur, 40);
        assert.equal(recurring.churnRate30, 25);
        assert.ok(bySource.some((row) => row.source === "partage-whatsapp" && row.count === 1));
        assert.ok(bySource.some((row) => row.source === null));
    });

    describe("recapitulatifs fiscaux annuels", () => {
        const lastYear = receiptYear(new Date()) - 1;
        let donor;

        before(async () => {
            donor = await createUser({ email: "annuel@test.hope.org" });
            const paidAt = new Date(Date.UTC(lastYear, 5, 15, 12));
            await createPayment({ user_id: donor.id, status: "succeeded", paid_at: paidAt, receipt_number: `HOPE-${lastYear}-000001` });
            await createPayment({ user_id: donor.id, status: "succeeded", paid_at: paidAt, amount: 15, receipt_number: `HOPE-${lastYear}-000002` });
            // Don echoue : ne compte pas.
            const other = await createUser({ email: "echec@test.hope.org" });
            await createPayment({ user_id: other.id, status: "failed", paid_at: paidAt });
        });

        it("n'envoie rien hors janvier", async () => {
            captureEmails();
            assert.equal(await annualService.runScheduled({ now: new Date(Date.UTC(lastYear + 1, 5, 2)) }), null);
            assert.equal(sent.length, 0);
        });

        it("envoie en janvier le PDF annuel une seule fois par compte et par annee", async () => {
            captureEmails();
            const result = await annualService.runScheduled({ now: new Date(Date.UTC(lastYear + 1, 0, 3, 12)) });
            assert.equal(result.sent, 1);
            assert.equal(result.completed, true);
            assert.equal(sent.length, 1);
            assert.equal(sent[0].to, "annuel@test.hope.org");
            assert.equal(sent[0].attachments[0].contentType, "application/pdf");
            assert.equal(sent[0].attachments[0].content.subarray(0, 5).toString(), "%PDF-");

            // Campagne terminee : plus rien, meme en relancant le worker.
            assert.equal(await annualService.runScheduled({ now: new Date(Date.UTC(lastYear + 1, 0, 4, 12)) }), null);
            assert.equal(sent.length, 1);
        });

        it("declenchement manuel par la finance (idempotent) et etat de la campagne", async () => {
            captureEmails();
            const res = await finance.post("/api/fundraising/admin/annual-summaries", { year: lastYear });
            assert.equal(res.status, 200);
            assert.equal(res.body.sent, 0, "deja envoye");
            const status = await finance.get(`/api/fundraising/admin/annual-summaries/${lastYear}`);
            assert.deepEqual(
                { recipients: status.body.recipients, sent: status.body.sent, completed: status.body.completed },
                { recipients: 1, sent: 1, completed: true }
            );
            assert.equal((await finance.post("/api/fundraising/admin/annual-summaries", { year: lastYear + 1 })).status, 400);
        });
    });
});
