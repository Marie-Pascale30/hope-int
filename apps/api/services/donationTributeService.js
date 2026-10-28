// E-carte d'hommage : envoyee une seule fois au proche indique par le donateur, apres confirmation
// du paiement. Elle ne mentionne jamais le montant. Message envoye a la demande du donateur (pas
// de prospection) : textes deja nettoyes a la saisie (texte brut, liens retires, longueurs bornees).
const paymentRepo = require("../repositories/paymentRepository");
const fundraisingRepo = require("../repositories/fundraisingRepository");
const emailService = require("./emailService");
const logService = require("./activityLogService");
const { singleLine } = require("./donationExtras");
const { FRONTEND_URL } = require("../utils/security");

const ORG_NAME = process.env.ORG_NAME || "HOPE International Project";

function buildCard(payment) {
    const donor = singleLine(payment.entered_donor_name || payment.donor_name, 150) || "Un donateur";
    const honoree = singleLine(payment.tribute_name, 120);
    const memory = payment.tribute_type === "memory";
    const designation = payment.project_title ? ` pour le projet « ${singleLine(payment.project_title, 200)} »` : "";
    const lines = [
        memory ? "Bonjour," : `Bonjour ${honoree},`,
        "",
        memory
            ? `${donor} a fait un don à ${ORG_NAME}${designation} à la mémoire de ${honoree}.`
            : `${donor} a fait un don à ${ORG_NAME}${designation} en votre honneur.`,
    ];
    if (payment.tribute_message) {
        lines.push("", `Son message :`, payment.tribute_message);
    }
    lines.push(
        "",
        `Ce geste soutient nos actions auprès des familles au Cameroun. Pour découvrir nos projets : ${FRONTEND_URL}/projets`,
        "",
        `L'équipe ${ORG_NAME}`,
        "",
        "Vous recevez ce message unique parce qu'une personne de votre entourage a souhaité vous prévenir de son don. Aucune autre communication ne vous sera envoyée."
    );
    return {
        subject: memory ? `${ORG_NAME} - Un don en mémoire d'un proche` : `${ORG_NAME} - Un don a été fait en votre honneur`,
        text: lines.join("\n"),
    };
}

exports.buildCard = buildCard;

// Envoie l'e-carte si le don confirme en prevoit une (reservation atomique : une seule fois).
exports.notify = async (paymentId) => {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment?.tribute_notify_email || payment.status !== "succeeded" || payment.tribute_notified_at) return false;
    if (!(await fundraisingRepo.claimTributeNotification(payment.id))) return false;
    const card = buildCard(payment);
    await emailService.send({ to: payment.tribute_notify_email, subject: card.subject, text: card.text });
    await logService.log({
        userId: payment.user_id,
        action: "donation.tribute_card_sent",
        meta: { paymentId: payment.id, tributeType: payment.tribute_type },
    });
    return true;
};
