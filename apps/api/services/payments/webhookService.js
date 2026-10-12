// Webhooks des prestataires : Stripe (signature verifiee par le SDK), Notch Pay (HMAC du corps
// brut) et Flutterwave (en-tete verif-hash). Le statut est toujours relu ou verifie, jamais
// deduit d'un simple appel entrant.
const paymentRepo = require("../../repositories/paymentRepository");
const stripeProvider = require("./stripeProvider");
const flutterwaveProvider = require("./flutterwaveProvider");
const notchpayProvider = require("./notchpayProvider");
const receiptService = require("../receiptService");
const logService = require("../activityLogService");
const { REFRESHABLE_STATUSES, applyStatus, sendReceipt } = require("./statusService");
const { refreshFlutterwave, refreshNotchpay } = require("./refreshService");
const { forbidden } = require("../../utils/httpError");
const { randomToken } = require("../../utils/security");

const { fromSeconds } = stripeProvider;
const refId = (value) => (value && typeof value === "object" ? value.id : value) || null;

// Montants Stripe en unite mineure (centimes), sauf devises sans decimales comme le XAF.
const fromStripeAmount = (amount, currency) => (String(currency).toLowerCase() === "xaf" ? Number(amount) : Number(amount) / 100);

async function findStripePayment({ paymentIntent, invoice }) {
    return (paymentIntent && (await paymentRepo.findByProviderRef(paymentIntent)))
        || (invoice && (await paymentRepo.findByTxId(invoice)))
        || null;
}

function invoicePaymentIntent(invoice) {
    return refId(invoice.payment_intent) || refId(invoice.payments?.data?.[0]?.payment?.payment_intent);
}

function invoiceSubscription(invoice) {
    return refId(invoice.subscription) || refId(invoice.parent?.subscription_details?.subscription);
}

// Fin de la periode couverte par la facture (prochaine echeance de l'abonnement).
function invoicePeriodEnd(invoice) {
    return fromSeconds(invoice.lines?.data?.[0]?.period?.end);
}

// Fin de la periode en cours d'un abonnement (champ par article depuis les API Stripe recentes).
function subscriptionPeriodEnd(subscription) {
    return fromSeconds(subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end);
}

async function recordRecurringInvoice(invoice) {
    const subscriptionId = invoiceSubscription(invoice);
    if (!subscriptionId || invoice.billing_reason !== "subscription_cycle") return;

    const original = await paymentRepo.findFirstBySubscription(subscriptionId);
    if (!original) return;

    // Projet termine ou supprime : l'echeance est affectee au fonds general (mention sur le recu).
    let projectId = original.project_id;
    let note = null;
    if (projectId && original.project_status === "termine") {
        note = `Projet « ${original.project_title} » terminé : échéance affectée au fonds général`;
        projectId = null;
    } else if (!projectId && original.receipt_designation) {
        note = `Projet « ${original.receipt_designation} » clôturé : échéance affectée au fonds général`;
    }

    const paidAt = fromSeconds(invoice.status_transitions?.paid_at);
    const created = await paymentRepo.createSucceeded({
        userId: original.user_id,
        amount: fromStripeAmount(invoice.amount_paid, invoice.currency),
        currency: invoice.currency,
        method: "card",
        provider: "stripe",
        txId: invoice.id,
        providerPaymentRef: invoicePaymentIntent(invoice),
        donorName: original.entered_donor_name || original.donor_name,
        donorEmail: original.entered_donor_email || original.donor_email,
        projectId,
        frequency: "monthly",
        subscriptionId,
        subscriptionStatus: "active",
        receiptToken: randomToken(24),
        paidAt: paidAt || new Date(),
    }, { yearOf: receiptService.receiptYear, note });

    if (!created) {
        // Deja enregistree (livraison concurrente ou ancienne ligne restee en attente).
        const existing = await paymentRepo.findByTxId(invoice.id);
        if (existing && existing.status !== "succeeded") await applyStatus(existing, "succeeded", "stripe_webhook", { paidAt });
        return;
    }
    await paymentRepo.setSubscriptionStatus(subscriptionId, "active");
    await logService.log({
        userId: original.user_id,
        action: "payment.succeeded",
        meta: {
            paymentId: created.id,
            amount: fromStripeAmount(invoice.amount_paid, invoice.currency),
            currency: invoice.currency,
            source: "stripe_webhook",
            subscriptionId,
            reassignedToGeneralFund: Boolean(note),
        },
    });
    sendReceipt(created.id);
}

async function handleChargeRefunded(charge) {
    const payment = await findStripePayment({ paymentIntent: refId(charge.payment_intent), invoice: refId(charge.invoice) });
    if (!payment) return;
    const refunded = fromStripeAmount(charge.amount_refunded || 0, charge.currency);
    const meta = { refundedAmount: refunded, chargeId: charge.id };
    if (charge.refunded || refunded >= Number(payment.amount)) {
        await applyStatus(payment, "refunded", "stripe_webhook", { refundedAmount: payment.amount, meta });
    } else if (refunded > 0 && (await paymentRepo.setRefundedAmount(payment.id, refunded))) {
        // Remboursement partiel : le don reste "succeeded", le montant net est deduit des statistiques
        // et indique sur le recu.
        await logService.log({ userId: payment.user_id, action: "payment.partially_refunded", meta: { paymentId: payment.id, ...meta } });
    }
}

async function handleDispute(type, dispute) {
    const payment = await findStripePayment({ paymentIntent: refId(dispute.payment_intent) });
    if (!payment) return;
    const meta = { disputeId: dispute.id, reason: dispute.reason, disputeStatus: dispute.status };
    if (type === "charge.dispute.created") {
        await applyStatus(payment, "disputed", "stripe_webhook", { meta });
    } else if (dispute.status === "won" || dispute.status === "warning_closed") {
        await applyStatus(payment, "succeeded", "stripe_webhook");
    } else if (dispute.status === "lost") {
        await applyStatus(payment, "refunded", "stripe_webhook", { refundedAmount: payment.amount, action: "payment.dispute_lost", meta });
    }
}

async function updateSubscription(subscriptionId, status, action, meta = {}) {
    if (!subscriptionId) return;
    const changed = await paymentRepo.setSubscriptionStatus(subscriptionId, status);
    if (changed) await logService.log({ action, meta: { subscriptionId, status, ...meta } });
}

const INTENT_STATUSES = {
    "payment_intent.succeeded": "succeeded",
    "payment_intent.payment_failed": "failed",
    "payment_intent.canceled": "canceled",
};

exports.handleStripeWebhook = async (signature, payloadBuffer) => {
    const event = await stripeProvider.parseWebhookEvent(signature, payloadBuffer);
    const object = event.data.object;

    if (event.type.startsWith("payment_intent.")) {
        const payment = await paymentRepo.findByProviderRef(object.id);
        const status = INTENT_STATUSES[event.type];
        // Date du paiement : charge reussie si developpee dans l'evenement, sinon date de l'evenement.
        const charge = object.latest_charge && typeof object.latest_charge === "object" ? object.latest_charge : null;
        const paidAt = fromSeconds(charge?.created || event.created);
        if (payment && status) await applyStatus(payment, status, "stripe_webhook", { paidAt });
    } else if (event.type === "invoice.paid") {
        await recordRecurringInvoice(object);
        await paymentRepo.setSubscriptionPeriodEnd(invoiceSubscription(object), invoicePeriodEnd(object));
    } else if (event.type === "invoice.payment_failed") {
        if (object.billing_reason === "subscription_cycle") {
            await updateSubscription(invoiceSubscription(object), "past_due", "payment.subscription_payment_failed", { invoiceId: object.id });
        }
    } else if (event.type === "charge.refunded") {
        await handleChargeRefunded(object);
    } else if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
        await handleDispute(event.type, object);
    } else if (event.type === "customer.subscription.updated") {
        await updateSubscription(object.id, object.status, "payment.subscription_updated");
        await paymentRepo.setSubscriptionPeriodEnd(object.id, subscriptionPeriodEnd(object));
    } else if (event.type === "customer.subscription.deleted") {
        await paymentRepo.setSubscriptionStatus(object.id, "canceled");
        await logService.log({ action: "payment.subscription_ended", meta: { subscriptionId: object.id } });
    }
    return event;
};

exports.handleNotchpayWebhook = async (signature, rawBody) => {
    if (!notchpayProvider.isValidWebhook(rawBody, signature)) throw forbidden("Signature de webhook invalide");
    const event = JSON.parse(rawBody.toString());
    if (!String(event.type || "").startsWith("payment.")) return;
    const data = event.data || {};
    const payment = (data.reference && (await paymentRepo.findByTxId(data.reference)))
        || (data.merchant_reference && (await paymentRepo.findByTxId(data.merchant_reference)));
    // Le statut est relu aupres de Notch Pay plutot que pris dans l'evenement. Tout don non
    // rembourse est relu : paiement tardif apres abandon, ou remboursement d'un don reussi.
    if (payment && payment.status !== "refunded") await refreshNotchpay(payment, "notchpay_webhook");
};

exports.handleFlutterwaveWebhook = async (headers, body) => {
    if (!flutterwaveProvider.isValidWebhook(headers)) throw forbidden("Signature de webhook invalide");
    const data = body?.data || {};
    const payment = data.tx_ref ? await paymentRepo.findByTxId(data.tx_ref) : null;
    if (payment && REFRESHABLE_STATUSES.includes(payment.status)) {
        await refreshFlutterwave(payment, { transactionId: data.id, source: "flutterwave_webhook" });
    }
};
