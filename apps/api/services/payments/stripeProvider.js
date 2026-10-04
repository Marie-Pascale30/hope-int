const Stripe = require("stripe");
const settingsRepo = require("../../repositories/settingsRepository");

const secretKey = process.env.STRIPE_SECRET_KEY || "";
// Les cles d'exemple du .env.example (sk_test_xxxx...) ne comptent pas comme configurees.
const enabled = /^sk_(test|live)_/.test(secretKey) && !/x{6,}/i.test(secretKey);
const stripe = enabled ? new Stripe(secretKey) : null;

const PRODUCT_SETTING_KEY = "stripe_monthly_donation_product";

function client() {
    if (!stripe) {
        const error = new Error("Le paiement par carte n'est pas configuré sur le serveur");
        error.status = 503;
        throw error;
    }
    return stripe;
}

async function getMonthlyProductId() {
    const cached = await settingsRepo.get(PRODUCT_SETTING_KEY);
    if (cached) return cached;
    const product = await client().products.create({
        name: "Don mensuel HOPE International",
        metadata: { hope_key: "monthly_donation" },
    });
    await settingsRepo.set(PRODUCT_SETTING_KEY, product.id);
    return product.id;
}

async function findOrCreateCustomer({ email, name }) {
    const existing = await client().customers.list({ email, limit: 1 });
    if (existing.data[0]) return existing.data[0];
    return client().customers.create({ email, name });
}

exports.isEnabled = () => enabled;

exports.createOneTimeIntent = async ({ amount, currency, paymentId, projectId }) => {
    const intent = await client().paymentIntents.create({
        amount: Math.round(Number(amount) * 100),
        currency,
        payment_method_types: ["card"],
        metadata: { paymentId: String(paymentId), projectId: projectId ? String(projectId) : "" },
        description: "Don HOPE International",
    });
    return { transactionId: intent.id, clientSecret: intent.client_secret };
};

// Abonnement mensuel : la premiere echeance se confirme cote client comme un paiement unique.
exports.createMonthlySubscription = async ({ amount, currency, paymentId, projectId, donorEmail, donorName }) => {
    const customer = await findOrCreateCustomer({ email: donorEmail, name: donorName });
    const subscription = await client().subscriptions.create({
        customer: customer.id,
        items: [{
            price_data: {
                currency,
                product: await getMonthlyProductId(),
                unit_amount: Math.round(Number(amount) * 100),
                recurring: { interval: "month" },
            },
        }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: ["card"] },
        metadata: { paymentId: String(paymentId), projectId: projectId ? String(projectId) : "" },
        expand: ["latest_invoice.confirmation_secret"],
    });

    const clientSecret = subscription.latest_invoice?.confirmation_secret?.client_secret;
    if (!clientSecret) throw new Error("Stripe n'a pas renvoyé de secret de confirmation pour l'abonnement");
    return {
        transactionId: clientSecret.split("_secret_")[0],
        subscriptionId: subscription.id,
        clientSecret,
    };
};

exports.retrieveIntentStatus = async (paymentIntentId) => {
    const intent = await client().paymentIntents.retrieve(paymentIntentId);
    return intent.status;
};

// Echeance d'abonnement enregistree sous l'id de facture (in_...) : draft | open | paid | uncollectible | void.
exports.retrieveInvoiceStatus = async (invoiceId) => {
    const invoice = await client().invoices.retrieve(invoiceId);
    return invoice.status;
};

// Avec STRIPE_WEBHOOK_SECRET : verification de signature. Sans : l'evenement est relu
// directement aupres de l'API Stripe, donc un appel forge ne peut rien valider.
exports.parseWebhookEvent = async (signature, payloadBuffer) => {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (endpointSecret) {
        return client().webhooks.constructEvent(payloadBuffer, signature, endpointSecret);
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error("STRIPE_WEBHOOK_SECRET est obligatoire en production");
    }
    const claimed = JSON.parse(payloadBuffer.toString());
    if (!claimed?.id || !String(claimed.id).startsWith("evt_")) throw new Error("Événement invalide");
    return client().events.retrieve(claimed.id);
};

exports.getSubscriptionStatus = async (subscriptionId) => {
    const subscription = await client().subscriptions.retrieve(subscriptionId);
    return { status: subscription.status, currentPeriodEnd: subscription.items?.data?.[0]?.current_period_end || null };
};

exports.cancelSubscription = async (subscriptionId) => {
    await client().subscriptions.cancel(subscriptionId);
};
