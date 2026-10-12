// Fonctions pures des recus : formatage des montants et des dates, vue figee d'un recu.
// Aucune dependance a PDFKit ni a la base (testables isolement).
const { XAF_PER_EUR } = require("@hope/shared/constants");
const { RECEIPT_TIMEZONE, formatDate, receiptYear, monthKey, yearBounds } = require("../utils/timezone");

const METHOD_LABELS = { card: "Carte bancaire", mobile_money: "Mobile Money" };
const GENERAL_FUND = "Fonds général de l'association";
const DONATION_NATURE = "Don en numéraire";

// Formatage manuel : les polices PDF standard ne gerent pas les espaces fines d'Intl.
function formatAmount(amount, currency) {
    const decimals = currency === "xaf" ? 0 : 2;
    const [integer, fraction] = Number(amount).toFixed(decimals).split(".");
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const value = fraction ? `${grouped},${fraction}` : grouped;
    return currency === "xaf" ? `${value} FCFA` : `${value} €`;
}

// Equivalent indicatif dans l'autre devise (parite fixe du franc CFA).
function equivalent(amount, currency) {
    return currency === "xaf"
        ? formatAmount(amount / XAF_PER_EUR, "eur")
        : formatAmount(Math.round(amount * XAF_PER_EUR), "xaf");
}

// Donnees imprimees : snapshot fige a l'emission, repli sur les donnees vivantes pour un ancien recu.
function receiptView(payment) {
    const frozen = Boolean(payment.receipt_issued_at);
    const pick = (snapshot, live) => (frozen && snapshot !== null && snapshot !== undefined ? snapshot : live);
    const currency = pick(payment.receipt_currency, payment.currency);
    const amount = Number(pick(payment.receipt_amount, payment.amount));
    const refunded = Number(payment.refunded_amount || 0);
    return {
        receiptNumber: payment.receipt_number,
        issuedAt: payment.receipt_issued_at || payment.paid_at || payment.created_at,
        paidAt: payment.paid_at || payment.receipt_issued_at || payment.created_at,
        donorName: pick(payment.receipt_donor_name, payment.entered_donor_name || payment.donor_name),
        donorEmail: pick(payment.receipt_donor_email, payment.entered_donor_email || payment.donor_email),
        designation: frozen ? payment.receipt_designation || GENERAL_FUND : payment.project_title || GENERAL_FUND,
        note: payment.receipt_note || null,
        amount,
        currency,
        method: pick(payment.receipt_method, payment.method),
        frequency: pick(payment.receipt_frequency, payment.frequency),
        refundedAmount: refunded > 0 && refunded < amount ? refunded : 0,
        transactionId: payment.transaction_id,
    };
}

function methodLabel(method) {
    return METHOD_LABELS[method] || method || "—";
}

function frequencyLabel(frequency) {
    return frequency === "monthly" ? "Don mensuel (échéance d'un don régulier)" : "Don ponctuel";
}


module.exports = {
    RECEIPT_TIMEZONE,
    GENERAL_FUND,
    DONATION_NATURE,
    formatAmount,
    formatDate,
    receiptYear,
    monthKey,
    yearBounds,
    equivalent,
    receiptView,
    methodLabel,
    frequencyLabel,
};
