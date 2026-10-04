const paymentRepo = require("../repositories/paymentRepository");
const contentRepo = require("../repositories/contentRepository");
const stripeProvider = require("./payments/stripeProvider");
const flutterwaveProvider = require("./payments/flutterwaveProvider");
const notchpayProvider = require("./payments/notchpayProvider");
const receiptService = require("./receiptService");
const logService = require("./activityLogService");
const { sendDonationReceiptEmail } = require("./emailService");
const { DONATION_LIMITS } = require("@hope/shared/constants");
const { badRequest, conflict, forbidden, notFound } = require("../utils/httpError");
const { FRONTEND_URL, randomToken } = require("../utils/security");

const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/$/, "");

// Au-dela de ce delai, un paiement toujours en attente est considere comme abandonne.
const ABANDON_AFTER_MINUTES = 24 * 60;
// Les dons echoues / annules recents sont relus par le rapprochement (paiement valide tardivement).
const RECHECK_CLOSED_DAYS = 7;

const MOBILE_MONEY_PROVIDERS = { notchpay: notchpayProvider, flutterwave: flutterwaveProvider };

// Machine d'etats : pour chaque statut cible, statuts d'origine autorises. La transition est
// appliquee atomiquement par MySQL (UPDATE ... WHERE status IN (...)).
// - un don reussi ne redevient jamais en attente / echoue / annule ;
// - succeeded -> refunded / disputed (remboursement, litige) ; disputed -> succeeded (litige gagne) ;
// - review (montant ou devise incoherents) se traite manuellement.
const TRANSITIONS = {
    succeeded: ["pending", "failed", "canceled", "disputed"],
    failed: ["pending"],
    canceled: ["pending", "failed"],
    review: ["pending", "failed", "canceled"],
    disputed: ["succeeded"],
    refunded: ["succeeded", "disputed", "review"],
};

// Statuts relus aupres du prestataire (page de remerciement, webhooks Mobile Money).
const REFRESHABLE_STATUSES = ["pending", "failed", "canceled"];

// Prestataire Mobile Money actif : MOBILE_MONEY_PROVIDER s'il est configure, sinon Notch Pay, sinon Flutterwave.
function getMobileMoneyProvider() {
    const preferred = process.env.MOBILE_MONEY_PROVIDER;
    if (MOBILE_MONEY_PROVIDERS[preferred]?.isEnabled()) return preferred;
    return ["notchpay", "flutterwave"].find((key) => MOBILE_MONEY_PROVIDERS[key].isEnabled()) || null;
}

exports.getProviders = () => {
    const mobileMoneyProvider = getMobileMoneyProvider();
    return {
        stripe: stripeProvider.isEnabled(),
        mobileMoney: Boolean(mobileMoneyProvider),
        mobileMoneyProvider,
        notchpay: notchpayProvider.isEnabled(),
        flutterwave: flutterwaveProvider.isEnabled(),
    };
};

// Vue publique d'un don (page de remerciement, espace membre) : pas d'identifiants internes.
function toPublicView(payment) {
    return {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        provider: payment.provider,
        frequency: payment.frequency,
        project_id: payment.project_id,
        project_title: payment.project_title,
        donor_name: payment.donor_name,
        receipt_number: payment.receipt_number,
        receipt_token: payment.receipt_token,
        subscription_id: payment.subscription_id,
        subscription_status: payment.subscription_status || null,
        refunded_amount: payment.refunded_amount || 0,
        paid_at: payment.paid_at,
        created_at: payment.created_at,
    };
}

async function sendReceipt(paymentId) {
    try {
        const payment = await paymentRepo.findById(paymentId);
        if (!payment?.receipt_number || payment.status !== "succeeded") return;
        const view = receiptService.receiptView(payment);
        if (!view.donorEmail) return;
        const pdfBuffer = await receiptService.generate(payment);
        await sendDonationReceiptEmail({
            to: view.donorEmail,
            fullName: view.donorName,
            amountLabel: receiptService.formatAmount(view.amount, view.currency),
            receiptNumber: payment.receipt_number,
            receiptUrl: `${API_PUBLIC_URL}/payment/receipts/${payment.receipt_token}/pdf`,
            pdfBuffer,
            paymentId: payment.id,
        });
    } catch (error) {
        console.error("receipt-email-error:", error.message);
    }
}

// Renvoi d'un recu (ex. receipt_sent_at vide apres une panne SMTP).
exports.resendReceipt = async (paymentId, actor) => {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw notFound("Don introuvable");
    if (payment.status !== "succeeded" || !payment.receipt_number) throw badRequest("Aucun reçu valide pour ce don");
    await sendReceipt(payment.id);
    if (actor) {
        await logService.log({ userId: actor.id, action: "payment.receipt_resent", meta: { paymentId: payment.id } });
    }
};

// Don en verification (montant ou devise incoherents) : decision manuelle apres controle chez le
// prestataire. Hors machine d'etats automatique, pour qu'aucun webhook ne valide seul un tel don.
exports.resolveReview = async (actor, paymentId, { decision, note }) => {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw notFound("Don introuvable");
    if (payment.status !== "review") throw badRequest("Ce don n'est pas en attente de vérification");

    if (decision === "approve") {
        const result = await paymentRepo.markSucceeded(payment.id, {
            fromStatuses: ["review"],
            yearOf: receiptService.receiptYear,
        });
        if (!result.changed) throw conflict("Ce don vient d'être traité par ailleurs");
        if (result.issued) sendReceipt(payment.id);
    } else {
        const changed = await paymentRepo.transitionStatus(payment.id, "canceled", ["review"]);
        if (!changed) throw conflict("Ce don vient d'être traité par ailleurs");
    }

    await logService.log({
        userId: actor.id,
        action: decision === "approve" ? "payment.review_approved" : "payment.review_rejected",
        meta: { paymentId: payment.id, amount: payment.amount, currency: payment.currency, note: note || null },
    });
    return paymentRepo.findById(payment.id);
};

// Applique un changement de statut si la machine d'etats l'autorise. Renvoie true si applique.
async function applyStatus(payment, status, source, extra = {}) {
    if (!payment || payment.status === status) return false;
    if (status === "succeeded") {
        const result = await paymentRepo.markSucceeded(payment.id, {
            fromStatuses: TRANSITIONS.succeeded,
            yearOf: receiptService.receiptYear,
        });
        if (!result.changed) return false;
        await logService.log({
            userId: payment.user_id,
            action: payment.status === "disputed" ? "payment.dispute_won" : "payment.succeeded",
            meta: { paymentId: payment.id, amount: payment.amount, currency: payment.currency, source, previous: payment.status },
        });
        if (payment.subscription_id) {
            await paymentRepo.setSubscriptionStatus(payment.subscription_id, "active", { onlyIf: ["incomplete"] });
        }
        if (result.issued) sendReceipt(payment.id);
        return true;
    }

    const changed = await paymentRepo.transitionStatus(
        payment.id,
        status,
        TRANSITIONS[status],
        extra.refundedAmount !== undefined ? { refundedAmount: extra.refundedAmount } : {}
    );
    if (!changed) return false;
    await logService.log({
        userId: payment.user_id,
        action: extra.action || `payment.${status}`,
        meta: { paymentId: payment.id, source, previous: payment.status, ...(extra.meta || {}) },
    });
    if (status === "refunded" && payment.receipt_number) {
        await logService.log({
            userId: payment.user_id,
            action: "payment.receipt_revoked",
            meta: { paymentId: payment.id, receiptNumber: payment.receipt_number, source },
        });
    }
    return true;
}

// Montant ou devise confirmes par le prestataire differents du don : a traiter manuellement.
async function flagForReview(payment, result, source) {
    await logService.log({
        userId: payment.user_id,
        action: "payment.amount_mismatch",
        meta: {
            paymentId: payment.id,
            source,
            expected: { amount: payment.amount, currency: payment.currency },
            received: { amount: result.amount, currency: result.currency, status: result.status },
        },
    });
    await applyStatus(payment, "review", source);
}

const STRIPE_STATUS_MAP = { succeeded: "succeeded", canceled: "canceled" };
const STRIPE_INVOICE_STATUS_MAP = { paid: "succeeded", void: "canceled", uncollectible: "failed" };

async function refreshStripe(payment, source) {
    if (!payment.transaction_id) return;
    // Echeance d'abonnement enregistree sous l'id de facture.
    if (payment.transaction_id.startsWith("in_")) {
        const status = STRIPE_INVOICE_STATUS_MAP[await stripeProvider.retrieveInvoiceStatus(payment.transaction_id)];
        if (status) await applyStatus(payment, status, source);
        return;
    }
    const status = STRIPE_STATUS_MAP[await stripeProvider.retrieveIntentStatus(payment.transaction_id)];
    if (status) await applyStatus(payment, status, source);
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
        await applyStatus(payment, "succeeded", source);
    } else if (result.status === "failed") {
        await applyStatus(payment, "failed", source);
    }
}

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

async function resolveProject(projectId) {
    if (!projectId) return null;
    const project = await contentRepo.getById("projects", projectId, { publishedOnly: true });
    if (!project) throw badRequest("Projet introuvable");
    if (project.status === "termine") throw badRequest("Ce projet est terminé : il ne reçoit plus de dons");
    return project;
}

exports.createDonation = async (user, input) => {
    // "mobile_money" (ou un prestataire Mobile Money nomme) -> prestataire Mobile Money actif.
    const provider = input.provider === "stripe" ? "stripe" : getMobileMoneyProvider();
    const currency = provider === "stripe" ? "eur" : "xaf";
    const frequency = input.frequency === "monthly" ? "monthly" : "once";
    const amount = currency === "xaf" ? Math.round(Number(input.amount)) : Math.round(Number(input.amount) * 100) / 100;

    const limits = DONATION_LIMITS[currency];
    if (!(amount >= limits.min && amount <= limits.max)) {
        throw badRequest(`Le montant doit être compris entre ${limits.min} et ${limits.max} ${currency.toUpperCase()}`);
    }
    if (frequency === "monthly" && provider !== "stripe") {
        throw badRequest("Le don mensuel est disponible uniquement par carte bancaire");
    }
    if (!provider || (provider === "stripe" && !stripeProvider.isEnabled())) {
        throw Object.assign(new Error("Ce moyen de paiement n'est pas encore disponible"), { status: 503 });
    }

    const donorName = user?.name || String(input.donorName || "").trim();
    const donorEmail = user?.email || String(input.donorEmail || "").trim().toLowerCase();
    if (!donorName || !donorEmail) throw badRequest("Nom et email du donateur obligatoires");

    const project = await resolveProject(input.projectId);
    const receiptToken = randomToken(24);

    const paymentId = await paymentRepo.create({
        userId: user?.id,
        amount,
        currency,
        method: provider === "stripe" ? "card" : "mobile_money",
        provider,
        status: "pending",
        donorName,
        donorEmail,
        projectId: project?.id,
        frequency,
        subscriptionStatus: frequency === "monthly" ? "incomplete" : null,
        receiptToken,
    });

    const response = { paymentId, provider, receiptToken };

    try {
        if (provider === "stripe") {
            const result = frequency === "monthly"
                ? await stripeProvider.createMonthlySubscription({ amount, currency, paymentId, projectId: project?.id, donorEmail, donorName })
                : await stripeProvider.createOneTimeIntent({ amount, currency, paymentId, projectId: project?.id });
            await paymentRepo.setTransactionId(paymentId, result.transactionId, result.subscriptionId);
            response.clientSecret = result.clientSecret;
        } else if (provider === "notchpay") {
            const result = await notchpayProvider.createPaymentLink({
                reference: `HOPE-${paymentId}-${randomToken(4)}`,
                amount,
                currency,
                callbackUrl: `${FRONTEND_URL}/don/merci?ref=${receiptToken}`,
                donorEmail,
                donorName,
                phone: input.phone,
                description: project ? `Don pour : ${project.title}` : "Don à HOPE International",
            });
            await paymentRepo.setTransactionId(paymentId, result.transactionId);
            response.redirectUrl = result.redirectUrl;
        } else {
            const txRef = `HOPE-${paymentId}-${randomToken(4)}`;
            await paymentRepo.setTransactionId(paymentId, txRef);
            response.redirectUrl = await flutterwaveProvider.createPaymentLink({
                txRef,
                amount,
                currency,
                redirectUrl: `${FRONTEND_URL}/don/merci?ref=${receiptToken}`,
                donorEmail,
                donorName,
                phone: input.phone,
                description: project ? `Don pour : ${project.title}` : "Don à HOPE International",
            });
        }
    } catch (error) {
        await paymentRepo.transitionStatus(paymentId, "failed", ["pending"]);
        throw error;
    }

    await logService.log({
        userId: user?.id || null,
        action: "payment.initiated",
        meta: { paymentId, provider, amount, currency, frequency, projectId: project?.id || null },
    });
    return response;
};

// Appelee par la page de remerciement : le statut est toujours relu aupres du prestataire,
// jamais deduit des parametres du navigateur (un retour "cancelled" laisse le don en attente).
exports.confirmByReceiptToken = async (token, { transactionId } = {}) => {
    const payment = await paymentRepo.findByReceiptToken(token);
    if (!payment) throw notFound("Don introuvable");

    if (REFRESHABLE_STATUSES.includes(payment.status)) {
        await refreshPayment(payment, { transactionId, source: "client_confirm" });
    }
    return toPublicView(await paymentRepo.findById(payment.id));
};

exports.getByReceiptToken = async (token) => {
    const payment = await paymentRepo.findByReceiptToken(token);
    if (!payment) throw notFound("Don introuvable");
    return toPublicView(payment);
};

exports.getReceiptPdf = async (token) => {
    const payment = await paymentRepo.findByReceiptToken(token);
    if (!payment) throw notFound("Reçu introuvable");
    if (payment.status === "refunded") {
        throw badRequest("Ce don a été remboursé : son reçu a été annulé et ne peut plus être téléchargé.", { code: "RECEIPT_REVOKED" });
    }
    if (payment.status === "disputed") {
        throw badRequest("Ce don fait l'objet d'une contestation bancaire : son reçu est suspendu jusqu'à la clôture du litige.", { code: "RECEIPT_SUSPENDED" });
    }
    if (payment.status === "review") {
        throw badRequest("Ce don est en cours de vérification par notre équipe : le reçu sera disponible après validation.", { code: "PAYMENT_UNDER_REVIEW" });
    }
    if (payment.status !== "succeeded" || !payment.receipt_number) {
        throw badRequest("Le reçu sera disponible une fois le paiement confirmé");
    }
    return { buffer: await receiptService.generate(payment), receiptNumber: payment.receipt_number };
};

// Recapitulatif annuel des dons confirmes du compte (annee civile dans RECEIPT_TIMEZONE).
exports.getAnnualReceiptPdf = async (user, year) => {
    const value = Number(year);
    const currentYear = receiptService.receiptYear(new Date());
    if (!Number.isInteger(value) || value < 2000 || value > currentYear) throw badRequest("Année invalide");
    const { from, to } = receiptService.yearBounds(value);
    const payments = await paymentRepo.getSucceededByUserBetween(user.id, from, to);
    if (!payments.length) throw notFound(`Aucun don confirmé en ${value}`);
    const buffer = await receiptService.generateAnnual({ year: value, donorName: user.name, donorEmail: user.email, payments });
    await logService.log({ userId: user.id, action: "payment.annual_receipt", meta: { year: value, count: payments.length } });
    return { buffer, year: value };
};

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

async function recordRecurringInvoice(invoice) {
    const subscriptionId = refId(invoice.subscription) || refId(invoice.parent?.subscription_details?.subscription);
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

    const paidAtSeconds = invoice.status_transitions?.paid_at;
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
        paidAt: paidAtSeconds ? new Date(paidAtSeconds * 1000) : new Date(),
    }, { yearOf: receiptService.receiptYear, note });

    if (!created) {
        // Deja enregistree (livraison concurrente ou ancienne ligne restee en attente).
        const existing = await paymentRepo.findByTxId(invoice.id);
        if (existing && existing.status !== "succeeded") await applyStatus(existing, "succeeded", "stripe_webhook");
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

exports.handleStripeWebhook = async (signature, payloadBuffer) => {
    const event = await stripeProvider.parseWebhookEvent(signature, payloadBuffer);
    const object = event.data.object;

    if (event.type.startsWith("payment_intent.")) {
        const payment = await paymentRepo.findByProviderRef(object.id);
        const status = {
            "payment_intent.succeeded": "succeeded",
            "payment_intent.payment_failed": "failed",
            "payment_intent.canceled": "canceled",
        }[event.type];
        if (payment && status) await applyStatus(payment, status, "stripe_webhook");
    } else if (event.type === "invoice.paid") {
        await recordRecurringInvoice(object);
    } else if (event.type === "invoice.payment_failed") {
        if (object.billing_reason === "subscription_cycle") {
            const subscriptionId = refId(object.subscription) || refId(object.parent?.subscription_details?.subscription);
            await updateSubscription(subscriptionId, "past_due", "payment.subscription_payment_failed", { invoiceId: object.id });
        }
    } else if (event.type === "charge.refunded") {
        await handleChargeRefunded(object);
    } else if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
        await handleDispute(event.type, object);
    } else if (event.type === "customer.subscription.updated") {
        await updateSubscription(object.id, object.status, "payment.subscription_updated");
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

// Rapprochement : relit aupres des prestataires les dons restes en attente, ainsi que les dons
// echoues / annules recents (paiement confirme tardivement).
exports.reconcile = async (actor) => {
    const pending = await paymentRepo.getPendingOlderThan(15);
    const closed = await paymentRepo.getRecentlyClosed(RECHECK_CLOSED_DAYS);
    const summary = {
        checked: pending.length + closed.length,
        succeeded: 0,
        recovered: 0,
        failed: 0,
        review: 0,
        abandoned: 0,
        errors: 0,
    };

    for (const row of [...pending, ...closed]) {
        const payment = await paymentRepo.findById(row.id);
        if (!payment) continue;
        const before = payment.status;
        try {
            const provider = { stripe: stripeProvider, ...MOBILE_MONEY_PROVIDERS }[payment.provider];
            if (provider?.isEnabled() && REFRESHABLE_STATUSES.includes(before)) await refreshPayment(payment, { source: "reconcile" });
        } catch (error) {
            summary.errors += 1;
            console.error(`reconcile-error #${payment.id}:`, error.message);
        }

        const after = await paymentRepo.findById(row.id);
        if (after.status === "succeeded") {
            summary.succeeded += 1;
            if (before !== "pending") summary.recovered += 1;
        } else if (after.status === "review") {
            summary.review += 1;
        } else if (after.status === "failed" && before === "pending") {
            summary.failed += 1;
        } else if (after.status === "pending" && Date.now() - new Date(after.created_at).getTime() > ABANDON_AFTER_MINUTES * 60000) {
            if (await paymentRepo.transitionStatus(after.id, "canceled", ["pending"])) {
                summary.abandoned += 1;
                await logService.log({
                    userId: after.user_id,
                    action: "payment.abandoned",
                    meta: { paymentId: after.id, provider: after.provider, createdAt: after.created_at, source: "reconcile" },
                });
            }
        }
    }

    await logService.log({ userId: actor?.id || null, action: "finance.reconcile", meta: summary });
    return summary;
};

exports.getForUser = async (user) => {
    const rows = await paymentRepo.getByUser(user.id);
    const payments = rows.map(toPublicView);

    // Dons mensuels : un abonnement par subscription_id, statut lu en base (tenu a jour par les
    // webhooks). Ancienne ligne sans statut : relu une fois chez Stripe puis enregistre.
    const subscriptionIds = [...new Set(rows.filter((p) => p.subscription_id).map((p) => p.subscription_id))];
    const subscriptions = [];
    for (const id of subscriptionIds) {
        const related = rows.filter((p) => p.subscription_id === id);
        const first = related.at(-1);
        let status = related.find((p) => p.subscription_status)?.subscription_status || null;
        if (!status && stripeProvider.isEnabled()) {
            try {
                status = (await stripeProvider.getSubscriptionStatus(id)).status;
                await paymentRepo.setSubscriptionStatus(id, status);
            } catch (_error) {
                status = null;
            }
        }
        subscriptions.push({
            id,
            status: status || "unknown",
            amount: first.amount,
            currency: first.currency,
            project_title: first.project_title,
            started_at: first.created_at,
        });
    }
    return { payments, subscriptions };
};

async function stopSubscription(subscriptionId, { userId, source, paymentId }) {
    await stripeProvider.cancelSubscription(subscriptionId);
    await paymentRepo.setSubscriptionStatus(subscriptionId, "canceled");
    await logService.log({ userId, action: "payment.subscription_canceled", meta: { subscriptionId, source, paymentId } });
}

exports.cancelSubscription = async (user, subscriptionId) => {
    const owned = (await paymentRepo.getByUser(user.id)).some((p) => p.subscription_id === subscriptionId);
    if (!owned) throw notFound("Don mensuel introuvable");
    await stopSubscription(subscriptionId, { userId: user.id, source: "account" });
};

// Arret d'un don mensuel sans compte, avec le jeton d'un des recus de l'abonnement.
exports.cancelSubscriptionByReceiptToken = async (token) => {
    const payment = await paymentRepo.findByReceiptToken(token);
    if (!payment) throw notFound("Don introuvable");
    if (payment.frequency !== "monthly" || !payment.subscription_id) {
        throw badRequest("Ce reçu ne correspond pas à un don mensuel");
    }
    if (payment.subscription_status === "canceled") return { alreadyCanceled: true };
    await stopSubscription(payment.subscription_id, { userId: payment.user_id, source: "receipt_token", paymentId: payment.id });
    return { alreadyCanceled: false };
};

exports.getAll = async (filters) => paymentRepo.getAll(filters);
exports.getForExport = async (filters) => paymentRepo.getForExport(filters);
exports.getSummary = async (filters) => paymentRepo.getSummary(filters);

// Expose pour les tests (machine d'etats).
exports._applyStatus = applyStatus;
exports.TRANSITIONS = TRANSITIONS;
