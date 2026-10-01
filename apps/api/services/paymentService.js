const paymentRepo = require("../repositories/paymentRepository");
const contentRepo = require("../repositories/contentRepository");
const stripeProvider = require("./payments/stripeProvider");
const flutterwaveProvider = require("./payments/flutterwaveProvider");
const notchpayProvider = require("./payments/notchpayProvider");
const receiptService = require("./receiptService");
const logService = require("./activityLogService");
const { sendDonationReceiptEmail } = require("./emailService");
const { DONATION_LIMITS } = require("@hope/shared/constants");
const { badRequest, forbidden, notFound } = require("../utils/httpError");
const { FRONTEND_URL, randomToken } = require("../utils/security");

const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/$/, "");

// Au-dela de ce delai, un paiement toujours en attente est considere comme abandonne.
const ABANDON_AFTER_MINUTES = 24 * 60;

const MOBILE_MONEY_PROVIDERS = { notchpay: notchpayProvider, flutterwave: flutterwaveProvider };

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
        paid_at: payment.paid_at,
        created_at: payment.created_at,
    };
}

async function sendReceipt(paymentId) {
    try {
        const payment = await paymentRepo.findById(paymentId);
        if (!payment?.donor_email || !payment.receipt_number) return;
        const pdfBuffer = await receiptService.generate(payment);
        await sendDonationReceiptEmail({
            to: payment.donor_email,
            fullName: payment.donor_name,
            amountLabel: receiptService.formatAmount(payment.amount, payment.currency),
            receiptNumber: payment.receipt_number,
            receiptUrl: `${API_PUBLIC_URL}/payment/receipts/${payment.receipt_token}/pdf`,
            pdfBuffer,
        });
    } catch (error) {
        console.error("receipt-email-error:", error.message);
    }
}

async function applyStatus(payment, status, source) {
    if (!payment || payment.status === status) return;
    if (status === "succeeded") {
        const changed = await paymentRepo.markSucceeded(payment.id);
        if (changed) {
            await logService.log({
                userId: payment.user_id,
                action: "payment.succeeded",
                meta: { paymentId: payment.id, amount: payment.amount, currency: payment.currency, source },
            });
            sendReceipt(payment.id);
        }
        return;
    }
    // Un don reussi ne redevient jamais "en attente" ou "echoue" par une source tierce.
    if (payment.status === "succeeded") return;
    await paymentRepo.updateStatus(payment.id, status);
    await logService.log({ userId: payment.user_id, action: `payment.${status}`, meta: { paymentId: payment.id, source } });
}

const STRIPE_STATUS_MAP = { succeeded: "succeeded", canceled: "canceled" };

async function refreshStripe(payment, source) {
    if (!payment.transaction_id) return;
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
            await logService.log({ action: "payment.amount_mismatch", meta: { paymentId: payment.id, result } });
            throw badRequest("Montant ou devise incohérents : le don n'a pas été validé");
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
    if (status === "succeeded" && (result.currency !== payment.currency || result.amount < Number(payment.amount))) {
        await logService.log({ action: "payment.amount_mismatch", meta: { paymentId: payment.id, result } });
        throw badRequest("Montant ou devise incohérents : le don n'a pas été validé");
    }
    if (status) await applyStatus(payment, status, source);
}

// Relit un paiement en attente chez son prestataire (quel qu'il soit).
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
        await paymentRepo.updateStatus(paymentId, "failed");
        throw error;
    }

    await logService.log({
        userId: user?.id || null,
        action: "payment.initiated",
        meta: { paymentId, provider, amount, currency, frequency, projectId: project?.id || null },
    });
    return response;
};

// Appelee par la page de remerciement : le statut est toujours relu aupres du prestataire.
exports.confirmByReceiptToken = async (token, { transactionId, redirectStatus } = {}) => {
    const payment = await paymentRepo.findByReceiptToken(token);
    if (!payment) throw notFound("Don introuvable");

    if (payment.status === "pending") {
        if (payment.provider === "flutterwave" && redirectStatus === "cancelled" && !transactionId) {
            await applyStatus(payment, "canceled", "client_redirect");
        } else {
            await refreshPayment(payment, { transactionId, source: "client_confirm" });
        }
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
    if (payment.status !== "succeeded" || !payment.receipt_number) {
        throw badRequest("Le reçu sera disponible une fois le paiement confirmé");
    }
    return { buffer: await receiptService.generate(payment), receiptNumber: payment.receipt_number };
};

async function recordRecurringInvoice(invoice) {
    const subscriptionId = invoice.subscription || invoice.parent?.subscription_details?.subscription;
    if (!subscriptionId || invoice.billing_reason !== "subscription_cycle") return;
    if (await paymentRepo.findByTxId(invoice.id)) return;

    const original = await paymentRepo.findFirstBySubscription(subscriptionId);
    if (!original) return;

    const id = await paymentRepo.create({
        userId: original.user_id,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        method: "card",
        provider: "stripe",
        status: "pending",
        txId: invoice.id,
        donorName: original.donor_name,
        donorEmail: original.donor_email,
        projectId: original.project_id,
        frequency: "monthly",
        subscriptionId,
        receiptToken: randomToken(24),
    });
    await applyStatus(await paymentRepo.findById(id), "succeeded", "stripe_webhook");
}

exports.handleStripeWebhook = async (signature, payloadBuffer) => {
    const event = await stripeProvider.parseWebhookEvent(signature, payloadBuffer);
    const object = event.data.object;

    if (event.type.startsWith("payment_intent.")) {
        const payment = await paymentRepo.findByTxId(object.id);
        const status = {
            "payment_intent.succeeded": "succeeded",
            "payment_intent.payment_failed": "failed",
            "payment_intent.canceled": "canceled",
        }[event.type];
        if (payment && status) await applyStatus(payment, status, "stripe_webhook");
    } else if (event.type === "invoice.paid") {
        await recordRecurringInvoice(object);
    } else if (event.type === "customer.subscription.deleted") {
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
    // Le statut est relu aupres de Notch Pay plutot que pris dans l'evenement.
    if (payment && payment.status === "pending") await refreshNotchpay(payment, "notchpay_webhook");
};

exports.handleFlutterwaveWebhook = async (headers, body) => {
    if (!flutterwaveProvider.isValidWebhook(headers)) throw forbidden("Signature de webhook invalide");
    const data = body?.data || {};
    const payment = data.tx_ref ? await paymentRepo.findByTxId(data.tx_ref) : null;
    if (payment && payment.status === "pending") {
        await refreshFlutterwave(payment, { transactionId: data.id, source: "flutterwave_webhook" });
    }
};

// Rapprochement : relit aupres des prestataires les dons restes en attente.
exports.reconcile = async (actor) => {
    const pending = await paymentRepo.getPendingOlderThan(15);
    const summary = { checked: pending.length, succeeded: 0, failed: 0, abandoned: 0, errors: 0 };

    for (const row of pending) {
        const payment = await paymentRepo.findById(row.id);
        try {
            const provider = { stripe: stripeProvider, ...MOBILE_MONEY_PROVIDERS }[payment.provider];
            if (provider?.isEnabled()) await refreshPayment(payment, { source: "reconcile" });
        } catch (error) {
            summary.errors += 1;
        }

        const after = await paymentRepo.findById(row.id);
        if (after.status === "succeeded") summary.succeeded += 1;
        else if (after.status === "failed") summary.failed += 1;
        else if (after.status === "pending" && Date.now() - new Date(after.created_at).getTime() > ABANDON_AFTER_MINUTES * 60000) {
            await paymentRepo.updateStatus(after.id, "canceled");
            summary.abandoned += 1;
        }
    }

    await logService.log({ userId: actor.id, action: "finance.reconcile", meta: summary });
    return summary;
};

exports.getForUser = async (user) => {
    const payments = (await paymentRepo.getByUser(user.id)).map(toPublicView);

    // Dons mensuels : un abonnement par subscription_id, statut relu chez Stripe.
    const subscriptionIds = [...new Set(payments.filter((p) => p.subscription_id).map((p) => p.subscription_id))];
    const subscriptions = [];
    for (const id of subscriptionIds) {
        const first = payments.filter((p) => p.subscription_id === id).at(-1);
        let status = "unknown";
        if (stripeProvider.isEnabled()) {
            try {
                status = (await stripeProvider.getSubscriptionStatus(id)).status;
            } catch (_error) {
                status = "unknown";
            }
        }
        subscriptions.push({
            id,
            status,
            amount: first.amount,
            currency: first.currency,
            project_title: first.project_title,
            started_at: first.created_at,
        });
    }
    return { payments, subscriptions };
};

exports.cancelSubscription = async (user, subscriptionId) => {
    const owned = (await paymentRepo.getByUser(user.id)).some((p) => p.subscription_id === subscriptionId);
    if (!owned) throw notFound("Don mensuel introuvable");
    await stripeProvider.cancelSubscription(subscriptionId);
    await logService.log({ userId: user.id, action: "payment.subscription_canceled", meta: { subscriptionId } });
};

exports.getAll = async (filters) => paymentRepo.getAll(filters);
exports.getSummary = async (filters) => paymentRepo.getSummary(filters);
