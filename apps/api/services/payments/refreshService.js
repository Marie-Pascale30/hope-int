// Relecture d'un don chez son prestataire (jamais d'apres les parametres du navigateur) et choix
// du prestataire Mobile Money actif.
const stripeProvider = require("./stripeProvider");
const flutterwaveProvider = require("./flutterwaveProvider");
const notchpayProvider = require("./notchpayProvider");
const { applyStatus, flagForReview } = require("./statusService");
const { badRequest } = require("../../utils/httpError");

const MOBILE_MONEY_PROVIDERS = { notchpay: notchpayProvider, flutterwave: flutterwaveProvider };

// Prestataire Mobile Money actif : MOBILE_MONEY_PROVIDER s'il est configure, sinon Notch Pay, sinon Flutterwave.
function getMobileMoneyProvider() {
    const preferred = process.env.MOBILE_MONEY_PROVIDER;
    if (MOBILE_MONEY_PROVIDERS[preferred]?.isEnabled()) return preferred;
    return ["notchpay", "flutterwave"].find((key) => MOBILE_MONEY_PROVIDERS[key].isEnabled()) || null;
}

// Module prestataire d'un don (stripe, notchpay, flutterwave).
function providerOf(name) {
    return { stripe: stripeProvider, ...MOBILE_MONEY_PROVIDERS }[name] || null;
}

const STRIPE_STATUS_MAP = { succeeded: "succeeded", canceled: "canceled" };
const STRIPE_INVOICE_STATUS_MAP = { paid: "succeeded", void: "canceled", uncollectible: "failed" };

async function refreshStripe(payment, source) {
    if (!payment.transaction_id) return;
    // Echeance d'abonnement enregistree sous l'id de facture.
    if (payment.transaction_id.startsWith("in_")) {
        const invoice = await stripeProvider.retrieveInvoice(payment.transaction_id);
        const status = STRIPE_INVOICE_STATUS_MAP[invoice.status];
        if (status) await applyStatus(payment, status, source, { paidAt: invoice.paidAt });
        return;
    }
    const intent = await stripeProvider.retrieveIntent(payment.transaction_id);
    const status = STRIPE_STATUS_MAP[intent.status];
    if (status) await applyStatus(payment, status, source, { paidAt: intent.paidAt });
}

async function refreshFlutterwave(payment, { transactionId, source }) {
    let result;
    try {
        result = await flutterwaveProvider.verifyTransaction({ transactionId, txRef: payment.transaction_id });
    } catch (error) {
        if (!transactionId) return; // reference encore inconnue chez Flutterwave : paiement non commence
        throw error;
    }
    if (result.txRef !== payment.transaction_id) throw badRequest("Transaction ne correspondant pas à ce don");

    if (result.status === "successful") {
        if (result.currency !== payment.currency || result.amount < Number(payment.amount)) {
            await flagForReview(payment, result, source);
            return;
        }
        await applyStatus(payment, "succeeded", source, { paidAt: result.paidAt });
    } else if (result.status === "failed") {
        await applyStatus(payment, "failed", source);
    }
}

// Notch Pay : sa reponse de verification n'est pas lue pour la date (date de confirmation retenue).
async function refreshNotchpay(payment, source) {
    let result;
    try {
        result = await notchpayProvider.verifyTransaction(payment.transaction_id);
    } catch (error) {
        if (error.status === 404) return; // paiement pas encore cree chez Notch Pay
        throw error;
    }
    const status = notchpayProvider.toPaymentStatus(result.status);
    if (!status) return;
    if (status === "succeeded") {
        if (payment.status === "succeeded") return;
        if (result.currency !== payment.currency || result.amount < Number(payment.amount)) {
            await flagForReview(payment, result, source);
            return;
        }
    }
    if (status === "refunded") {
        await applyStatus(payment, "refunded", source, { refundedAmount: payment.amount });
        return;
    }
    await applyStatus(payment, status, source);
}

// Relit un paiement chez son prestataire (quel qu'il soit).
async function refreshPayment(payment, { transactionId, source }) {
    if (payment.provider === "stripe") return refreshStripe(payment, source);
    if (payment.provider === "notchpay") return refreshNotchpay(payment, source);
    return refreshFlutterwave(payment, { transactionId, source });
}

module.exports = {
    MOBILE_MONEY_PROVIDERS,
    getMobileMoneyProvider,
    providerOf,
    refreshPayment,
    refreshFlutterwave,
    refreshNotchpay,
};
