// Dons mensuels Stripe en echec (invoice.payment_failed) : le donateur est prevenu une fois par
// facture, avec un lien vers la page de son don ou il ouvre le portail de facturation Stripe
// pour mettre a jour sa carte. La session du portail est creee a la demande (endpoint dedie).
const paymentRepo = require("../repositories/paymentRepository");
const fundraisingRepo = require("../repositories/fundraisingRepository");
const stripeProvider = require("./payments/stripeProvider");
const emailService = require("./emailService");
const preferences = require("./preferences");
const logService = require("./activityLogService");
const receiptFormat = require("./receiptFormat");
const { badRequest, notFound } = require("../utils/httpError");
const { FRONTEND_URL } = require("../utils/security");

const ORG_NAME = process.env.ORG_NAME || "HOPE International Project";

const updateCardUrl = (receiptToken) => `${FRONTEND_URL}/don/merci?ref=${receiptToken}&carte=1`;

exports.updateCardUrl = updateCardUrl;

exports.notifyPaymentFailed = async ({ invoiceId, subscriptionId, attempt }) => {
    if (!invoiceId || !subscriptionId) return false;
    const original = await paymentRepo.findFirstBySubscription(subscriptionId);
    const email = original?.entered_donor_email || original?.donor_email;
    if (!original || !email || original.subscription_status === "canceled") return false;
    if (!(await preferences.canContact(email, "donation_reminders"))) return false;
    if (!(await fundraisingRepo.claimMarker("dunning", invoiceId))) return false;

    const name = String(original.entered_donor_name || original.donor_name || "").split(" ")[0];
    const amount = receiptFormat.formatAmount(original.amount, original.currency);
    const footer = await preferences.unsubscribeFooter(email, "donation_reminders");
    const text = [
        name ? `Bonjour ${name},` : "Bonjour,",
        "",
        `Le prélèvement de votre don mensuel de ${amount} n'a pas pu être effectué (carte expirée, plafond atteint ou refus de la banque).`,
        "Votre soutien compte beaucoup pour nous : vous pouvez mettre à jour votre carte en quelques secondes, sur la page sécurisée de notre prestataire Stripe :",
        "",
        `Mettre à jour ma carte : ${updateCardUrl(original.receipt_token)}`,
        "",
        "Stripe retentera automatiquement le prélèvement dans les prochains jours. Si vous préférez arrêter votre don mensuel, vous pouvez aussi le faire depuis cette page.",
        `L'équipe ${ORG_NAME}`,
    ].join("\n");
    await emailService.send({
        to: email,
        subject: `${ORG_NAME} - Votre don mensuel n'a pas pu être prélevé`,
        text: footer ? `${text}\n\n${footer}` : text,
    });
    await logService.log({
        userId: original.user_id,
        action: "donation.subscription_dunning_sent",
        meta: { subscriptionId, invoiceId, attempt: attempt || null },
    });
    return true;
};

async function portalFor(payment, source, userId) {
    if (payment.frequency !== "monthly" || !payment.subscription_id) throw badRequest("Ce reçu ne correspond pas à un don mensuel");
    if (payment.subscription_status === "canceled") throw badRequest("Ce don mensuel est arrêté");
    const { url } = await stripeProvider.createBillingPortalSession({
        subscriptionId: payment.subscription_id,
        returnUrl: `${FRONTEND_URL}/don/merci?ref=${payment.receipt_token}`,
    });
    await logService.log({ userId: userId || null, action: "donation.billing_portal_opened", meta: { subscriptionId: payment.subscription_id, source } });
    return { url };
}

// Sans compte : jeton d'un recu de l'abonnement.
exports.portalByReceiptToken = async (token) => {
    const payment = await paymentRepo.findByReceiptToken(token);
    if (!payment) throw notFound("Don introuvable");
    return portalFor(payment, "receipt_token", payment.user_id);
};

// Membre connecte : abonnement rattache a son compte.
exports.portalForUser = async (user, subscriptionId) => {
    const owned = (await paymentRepo.getByUser(user.id)).find((p) => p.subscription_id === subscriptionId);
    if (!owned) throw notFound("Don mensuel introuvable");
    return portalFor(owned, "account", user.id);
};
