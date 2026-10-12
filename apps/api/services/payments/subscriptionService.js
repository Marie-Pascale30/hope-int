// Dons mensuels (abonnements Stripe) : espace membre et arret, avec ou sans compte.
const paymentRepo = require("../../repositories/paymentRepository");
const stripeProvider = require("./stripeProvider");
const logService = require("../activityLogService");
const { toPublicView } = require("./donationService");
const { badRequest, notFound } = require("../../utils/httpError");

// Statuts pour lesquels une prochaine echeance est attendue.
const ONGOING_STATUSES = ["active", "trialing", "past_due"];

const toIso = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

exports.getForUser = async (user) => {
    const rows = await paymentRepo.getByUser(user.id);
    const payments = rows.map(toPublicView);

    // Dons mensuels : un abonnement par subscription_id, statut et prochaine echeance lus en base
    // (tenus a jour par les webhooks). Ancienne ligne sans statut : relue une fois chez Stripe
    // (statut et fin de periode) puis enregistree.
    const subscriptionIds = [...new Set(rows.filter((p) => p.subscription_id).map((p) => p.subscription_id))];
    const subscriptions = [];
    for (const id of subscriptionIds) {
        const related = rows.filter((p) => p.subscription_id === id);
        const first = related.at(-1);
        let status = related.find((p) => p.subscription_status)?.subscription_status || null;
        let periodEnd = related.find((p) => p.subscription_period_end)?.subscription_period_end || null;
        if (!status && stripeProvider.isEnabled()) {
            try {
                const remote = await stripeProvider.getSubscriptionStatus(id);
                status = remote.status;
                periodEnd = periodEnd || remote.currentPeriodEnd;
                await paymentRepo.setSubscriptionStatus(id, status);
                await paymentRepo.setSubscriptionPeriodEnd(id, remote.currentPeriodEnd);
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
            next_payment_at: ONGOING_STATUSES.includes(status) ? toIso(periodEnd) : null,
        });
    }
    return { payments, subscriptions };
};

// Abonnement deja supprime chez Stripe (resource_missing) : l'arret local reste applique.
async function stopSubscription(subscriptionId, { userId, source, paymentId }) {
    let alreadyDeleted = false;
    try {
        await stripeProvider.cancelSubscription(subscriptionId);
    } catch (error) {
        if (error.code !== "resource_missing" && error.raw?.code !== "resource_missing") throw error;
        alreadyDeleted = true;
    }
    await paymentRepo.setSubscriptionStatus(subscriptionId, "canceled");
    await logService.log({
        userId,
        action: "payment.subscription_canceled",
        meta: { subscriptionId, source, paymentId, ...(alreadyDeleted ? { alreadyDeletedAtProvider: true } : {}) },
    });
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
