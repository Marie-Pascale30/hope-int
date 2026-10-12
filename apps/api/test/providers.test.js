// Tests unitaires des prestataires de paiement : aucun appel reseau (fetch et SDK Stripe simules).
// Les modules lisent leur configuration au chargement : chaque test les recharge avec ses variables.
process.env.NODE_ENV = "test";
const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const Module = require("module");
const path = require("path");

const PROVIDERS_DIR = path.join(__dirname, "..", "services", "payments");
const STRIPE_PATH = require.resolve("stripe", { paths: [PROVIDERS_DIR] });
const ENV_KEYS = [
    "NOTCHPAY_PUBLIC_KEY", "NOTCHPAY_PRIVATE_KEY", "NOTCHPAY_WEBHOOK_HASH",
    "FLUTTERWAVE_SECRET_KEY", "FLUTTERWAVE_WEBHOOK_HASH", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function load(name, env = {}) {
    for (const key of ENV_KEYS) delete process.env[key];
    Object.assign(process.env, env);
    const file = path.join(PROVIDERS_DIR, name);
    delete require.cache[require.resolve(file)];
    return require(file);
}

// Remplace le SDK Stripe par un faux client (instance partagee, methodes a definir par test).
function fakeStripe(client) {
    const fake = new Module(STRIPE_PATH);
    fake.exports = function FakeStripe() {
        return client;
    };
    fake.loaded = true;
    require.cache[STRIPE_PATH] = fake;
}

// Reponse fetch simulee ; calls recoit les appels { url, options }.
function mockFetch(t, responses) {
    const calls = [];
    const queue = Array.isArray(responses) ? [...responses] : null;
    t.mock.method(globalThis, "fetch", async (url, options) => {
        calls.push({ url, options });
        const { status = 200, body = {} } = queue ? queue.shift() : responses;
        return { ok: status >= 200 && status < 300, status, json: async () => body };
    });
    return calls;
}

afterEach(() => {
    delete require.cache[STRIPE_PATH];
    for (const key of ENV_KEYS) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
    }
});

describe("Notch Pay", () => {
    const env = { NOTCHPAY_PUBLIC_KEY: "pk_test.cle123", NOTCHPAY_PRIVATE_KEY: "sk_prive", NOTCHPAY_WEBHOOK_HASH: "hash-secret" };

    it("n'est actif qu'avec une vraie cle publique", () => {
        assert.equal(load("notchpayProvider.js", env).isEnabled(), true);
        assert.equal(load("notchpayProvider.js", { NOTCHPAY_PUBLIC_KEY: "pk_test_xxxxxxxx" }).isEnabled(), false);
        assert.equal(load("notchpayProvider.js").isEnabled(), false);
    });

    it("refuse tout appel sans configuration (503)", async () => {
        await assert.rejects(load("notchpayProvider.js").verifyTransaction("trx"), { status: 503 });
    });

    it("cree un lien de paiement avec les en-tetes et la reference attendus", async (t) => {
        const notchpay = load("notchpayProvider.js", env);
        const calls = mockFetch(t, { body: { transaction: { reference: "trx.np42" }, authorization_url: "https://pay.notchpay.co/trx.np42" } });
        const result = await notchpay.createPaymentLink({
            reference: "HOPE-1-ab", amount: "5000", currency: "xaf", callbackUrl: "https://site/merci", donorEmail: "a@b.c", donorName: "Ada", description: "Don",
        });
        assert.deepEqual(result, { transactionId: "trx.np42", redirectUrl: "https://pay.notchpay.co/trx.np42" });
        assert.equal(calls[0].url, "https://api.notchpay.co/payments");
        assert.equal(calls[0].options.headers.Authorization, "pk_test.cle123");
        assert.equal(calls[0].options.headers["X-Grant"], "sk_prive");
        const body = JSON.parse(calls[0].options.body);
        assert.equal(body.amount, 5000);
        assert.equal(body.currency, "XAF");
        assert.equal(body.reference, "HOPE-1-ab");
    });

    it("garde la reference du marchand si Notch Pay n'en renvoie pas", async (t) => {
        const notchpay = load("notchpayProvider.js", env);
        mockFetch(t, { body: { transaction: "trx", authorization_url: "https://pay" } });
        const result = await notchpay.createPaymentLink({ reference: "HOPE-2-cd", amount: 100, currency: "xaf" });
        assert.equal(result.transactionId, "HOPE-2-cd");
    });

    it("normalise la verification et distingue un paiement inconnu (404)", async (t) => {
        const notchpay = load("notchpayProvider.js", env);
        mockFetch(t, [
            { body: { transaction: { reference: "trx.1", trxref: "HOPE-1", status: "complete", amount: "5000", currency: "XAF" } } },
            { status: 404, body: { message: "Payment not found" } },
            { status: 500, body: {} },
        ]);
        assert.deepEqual(await notchpay.verifyTransaction("trx.1"), {
            reference: "trx.1", merchantReference: "HOPE-1", status: "complete", amount: 5000, currency: "xaf",
        });
        await assert.rejects(notchpay.verifyTransaction("trx.2"), { status: 404, message: "Payment not found" });
        await assert.rejects(notchpay.verifyTransaction("trx.3"), { status: 502, message: "Erreur du prestataire Mobile Money" });
    });

    it("convertit les statuts Notch Pay", () => {
        const { toPaymentStatus } = load("notchpayProvider.js", env);
        assert.equal(toPaymentStatus("complete"), "succeeded");
        assert.equal(toPaymentStatus("failed"), "failed");
        assert.equal(toPaymentStatus("rejected"), "failed");
        assert.equal(toPaymentStatus("expired"), "canceled");
        assert.equal(toPaymentStatus("abandoned"), "canceled");
        assert.equal(toPaymentStatus("refunded"), "refunded");
        assert.equal(toPaymentStatus("pending"), null);
    });

    it("verifie la signature HMAC-SHA256 du corps brut", () => {
        const notchpay = load("notchpayProvider.js", env);
        const raw = Buffer.from(JSON.stringify({ type: "payment.complete" }));
        const signature = crypto.createHmac("sha256", "hash-secret").update(raw).digest("hex");
        assert.equal(notchpay.isValidWebhook(raw, signature), true);
        assert.equal(notchpay.isValidWebhook(raw, signature.replace(/.$/, "0")), signature.endsWith("0"));
        assert.equal(notchpay.isValidWebhook(Buffer.from("{}"), signature), false);
        assert.equal(notchpay.isValidWebhook(raw, "court"), false);
        assert.equal(notchpay.isValidWebhook(raw, undefined), false);
        assert.equal(load("notchpayProvider.js", { NOTCHPAY_PUBLIC_KEY: "pk.x" }).isValidWebhook(raw, signature), false);
    });
});

describe("Flutterwave", () => {
    const env = { FLUTTERWAVE_SECRET_KEY: "FLWSECK_TEST-abc-X", FLUTTERWAVE_WEBHOOK_HASH: "verif-secret" };

    it("n'est actif qu'avec une vraie cle secrete", () => {
        assert.equal(load("flutterwaveProvider.js", env).isEnabled(), true);
        assert.equal(load("flutterwaveProvider.js", { FLUTTERWAVE_SECRET_KEY: "FLWSECK_TEST-xxxxxxxx" }).isEnabled(), false);
    });

    it("cree un lien de paiement Mobile Money", async (t) => {
        const flutterwave = load("flutterwaveProvider.js", env);
        const calls = mockFetch(t, { body: { status: "success", data: { link: "https://checkout.flutterwave.com/x" } } });
        const link = await flutterwave.createPaymentLink({ txRef: "HOPE-3-ef", amount: 3000, currency: "xaf", donorEmail: "a@b.c", donorName: "Ada" });
        assert.equal(link, "https://checkout.flutterwave.com/x");
        assert.equal(calls[0].options.headers.Authorization, "Bearer FLWSECK_TEST-abc-X");
        assert.equal(JSON.parse(calls[0].options.body).payment_options, "mobilemoneyfranco,card");
    });

    it("verifie une transaction par id ou par reference, avec sa date", async (t) => {
        const flutterwave = load("flutterwaveProvider.js", env);
        const data = { tx_ref: "HOPE-3-ef", status: "successful", amount: "3000", currency: "XAF", created_at: "2026-02-10T09:00:00.000Z" };
        const calls = mockFetch(t, { body: { status: "success", data } });
        const expected = { txRef: "HOPE-3-ef", status: "successful", amount: 3000, currency: "xaf", paidAt: "2026-02-10T09:00:00.000Z" };
        assert.deepEqual(await flutterwave.verifyTransaction({ transactionId: 42 }), expected);
        assert.deepEqual(await flutterwave.verifyTransaction({ txRef: "HOPE-3-ef" }), expected);
        assert.match(calls[0].url, /\/transactions\/42\/verify$/);
        assert.match(calls[1].url, /verify_by_reference\?tx_ref=HOPE-3-ef$/);
    });

    it("traite un statut d'erreur dans le corps comme une erreur du prestataire", async (t) => {
        const flutterwave = load("flutterwaveProvider.js", env);
        mockFetch(t, { body: { status: "error", message: "No transaction was found" } });
        await assert.rejects(flutterwave.verifyTransaction({ transactionId: 1 }), { status: 502, message: "No transaction was found" });
    });

    it("compare l'en-tete verif-hash en temps constant", (t) => {
        const flutterwave = load("flutterwaveProvider.js", env);
        const compare = t.mock.method(crypto, "timingSafeEqual");
        assert.equal(flutterwave.isValidWebhook({ "verif-hash": "verif-secret" }), true);
        assert.equal(compare.mock.callCount(), 1);
        assert.equal(flutterwave.isValidWebhook({ "verif-hash": "verif-secreT" }), false);
        assert.equal(flutterwave.isValidWebhook({ "verif-hash": "autre" }), false);
        assert.equal(flutterwave.isValidWebhook({}), false);
        assert.equal(load("flutterwaveProvider.js").isValidWebhook({ "verif-hash": "" }), false);
    });
});

describe("Stripe", () => {
    const env = { STRIPE_SECRET_KEY: "sk_test_unitaire123" };

    it("n'est actif qu'avec une vraie cle secrete", async () => {
        assert.equal(load("stripeProvider.js", env).isEnabled(), true);
        const disabled = load("stripeProvider.js", { STRIPE_SECRET_KEY: "sk_test_xxxxxxxxxxxx" });
        assert.equal(disabled.isEnabled(), false);
        await assert.rejects(disabled.retrieveIntent("pi_1"), { status: 503 });
    });

    it("verifie la signature des webhooks avec STRIPE_WEBHOOK_SECRET", async () => {
        const stripe = load("stripeProvider.js", { ...env, STRIPE_WEBHOOK_SECRET: "whsec_unitaire" });
        const Stripe = require("stripe");
        const payload = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded", data: { object: { id: "pi_1" } } });
        const header = new Stripe("sk_test_unitaire123").webhooks.generateTestHeaderString({ payload, secret: "whsec_unitaire" });

        const event = await stripe.parseWebhookEvent(header, Buffer.from(payload));
        assert.equal(event.id, "evt_1");
        await assert.rejects(stripe.parseWebhookEvent("t=1,v1=faux", Buffer.from(payload)));
        await assert.rejects(stripe.parseWebhookEvent(header, Buffer.from(payload.replace("pi_1", "pi_2"))));
    });

    it("sans secret : relit l'evenement chez Stripe, refuse en production", async () => {
        const retrieved = [];
        fakeStripe({ events: { retrieve: async (id) => (retrieved.push(id), { id, type: "invoice.paid" }) } });
        const stripe = load("stripeProvider.js", env);
        assert.equal((await stripe.parseWebhookEvent(null, Buffer.from(JSON.stringify({ id: "evt_42" })))).type, "invoice.paid");
        assert.deepEqual(retrieved, ["evt_42"]);
        await assert.rejects(stripe.parseWebhookEvent(null, Buffer.from(JSON.stringify({ id: "pas-un-evenement" }))), /invalide/);

        process.env.NODE_ENV = "production";
        try {
            await assert.rejects(stripe.parseWebhookEvent(null, Buffer.from("{}")), /STRIPE_WEBHOOK_SECRET/);
        } finally {
            process.env.NODE_ENV = "test";
        }
    });

    it("renvoie le statut et la date reelle d'un paiement ou d'une facture", async () => {
        const options = [];
        fakeStripe({
            paymentIntents: {
                retrieve: async (id, opts) => {
                    options.push(opts);
                    return id === "pi_ok"
                        ? { status: "succeeded", latest_charge: { created: 1767220200 } }
                        : { status: "requires_payment_method", latest_charge: null };
                },
            },
            invoices: { retrieve: async () => ({ status: "paid", status_transitions: { paid_at: 1767220200 } }) },
        });
        const stripe = load("stripeProvider.js", env);
        assert.deepEqual(await stripe.retrieveIntent("pi_ok"), { status: "succeeded", paidAt: new Date(1767220200 * 1000) });
        assert.deepEqual(await stripe.retrieveIntent("pi_ko"), { status: "requires_payment_method", paidAt: null });
        assert.deepEqual(options[0], { expand: ["latest_charge"] });
        assert.deepEqual(await stripe.retrieveInvoice("in_1"), { status: "paid", paidAt: new Date(1767220200 * 1000) });
        assert.equal(stripe.fromSeconds(null), null);
    });

    it("lit le statut et la fin de periode d'un abonnement, et l'annule", async () => {
        const canceled = [];
        fakeStripe({
            subscriptions: {
                retrieve: async (id) => (id === "sub_new"
                    ? { status: "active", items: { data: [{ current_period_end: 1767220200 }] } }
                    : { status: "past_due", current_period_end: 1767220300 }),
                cancel: async (id) => canceled.push(id),
            },
        });
        const stripe = load("stripeProvider.js", env);
        assert.deepEqual(await stripe.getSubscriptionStatus("sub_new"), { status: "active", currentPeriodEnd: new Date(1767220200 * 1000) });
        assert.deepEqual(await stripe.getSubscriptionStatus("sub_old"), { status: "past_due", currentPeriodEnd: new Date(1767220300 * 1000) });
        await stripe.cancelSubscription("sub_new");
        assert.deepEqual(canceled, ["sub_new"]);
    });

    it("cree un paiement unique et un abonnement mensuel", async (t) => {
        const created = {};
        fakeStripe({
            paymentIntents: { create: async (params) => ((created.intent = params), { id: "pi_new", client_secret: "pi_new_secret_x" }) },
            customers: { list: async () => ({ data: [] }), create: async (params) => ({ id: "cus_1", ...params }) },
            products: { create: async () => ({ id: "prod_1" }) },
            subscriptions: {
                create: async (params) => ((created.subscription = params), {
                    id: "sub_1", latest_invoice: { confirmation_secret: { client_secret: "pi_sub_secret_y" } },
                }),
            },
        });
        const stripe = load("stripeProvider.js", env);
        const settingsRepo = require("../repositories/settingsRepository");
        const stored = {};
        t.mock.method(settingsRepo, "get", async (key) => stored[key] || null);
        t.mock.method(settingsRepo, "set", async (key, value) => {
            stored[key] = value;
        });

        assert.deepEqual(await stripe.createOneTimeIntent({ amount: 12.5, currency: "eur", paymentId: 7 }), { transactionId: "pi_new", clientSecret: "pi_new_secret_x" });
        assert.equal(created.intent.amount, 1250);
        assert.equal(created.intent.metadata.paymentId, "7");

        const monthly = await stripe.createMonthlySubscription({ amount: 10, currency: "eur", paymentId: 8, donorEmail: "a@b.c", donorName: "Ada" });
        assert.deepEqual(monthly, { transactionId: "pi_sub", subscriptionId: "sub_1", clientSecret: "pi_sub_secret_y" });
        assert.equal(created.subscription.customer, "cus_1");
        assert.equal(created.subscription.items[0].price_data.product, "prod_1");
        assert.equal(stored.stripe_monthly_donation_product, "prod_1");
    });
});
