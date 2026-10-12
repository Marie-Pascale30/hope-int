// Relance des paiements abandonnes : don echoue, annule ou reste en attente depuis 2 h (puis une
// seconde et derniere relance a 24 h), donateur avec email, sans don reussi ni nouvelle tentative
// depuis, et consentement "donation_reminders". Le lien "Reprendre mon don" pre-remplit /don.
const paymentRepo = require("../repositories/paymentRepository");
const fundraisingRepo = require("../repositories/fundraisingRepository");
const emailService = require("./emailService");
const preferences = require("./preferences");
const logService = require("./activityLogService");
const receiptFormat = require("./receiptFormat");
const { SOURCES } = require("@hope/shared/fundraising");
const { FRONTEND_URL } = require("../utils/security");

const ORG_NAME = process.env.ORG_NAME || "HOPE International";
const FIRST_HOURS = Number(process.env.DONATION_REMINDER_FIRST_HOURS || 2);
const SECOND_HOURS = Number(process.env.DONATION_REMINDER_SECOND_HOURS || 24);
// Au-dela, un don abandonne n'est plus relance.
const MAX_DAYS = 3;
const BATCH = 50;

// Lien qui pre-remplit le formulaire de don (montant, devise, moyen, frequence, projet, collecte).
function resumeUrl(payment) {
    const params = new URLSearchParams({
        montant: String(payment.amount),
        devise: payment.currency,
        moyen: payment.method === "mobile_money" ? "mobile_money" : "card",
        ref: SOURCES.reminder,
    });
    if (payment.frequency === "monthly") params.set("frequence", "monthly");
    if (payment.project_id) params.set("projet", String(payment.project_id));
    if (payment.fundraiser_slug) params.set("collecte", payment.fundraiser_slug);
    return `${FRONTEND_URL}/don?${params.toString()}`;
}

function buildEmail(payment, { second }) {
    const name = String(payment.entered_donor_name || payment.donor_name || "").split(" ")[0];
    const amount = receiptFormat.formatAmount(payment.amount, payment.currency);
    const target = payment.project_title ? ` pour « ${payment.project_title} »` : "";
    return {
        subject: second ? `${ORG_NAME} - Votre don n'a pas abouti` : `${ORG_NAME} - Reprendre votre don`,
        text: [
            name ? `Bonjour ${name},` : "Bonjour,",
            "",
            `Vous avez commencé un don de ${amount}${target}, mais le paiement n'a pas abouti (connexion interrompue, solde insuffisant ou page fermée).`,
            "Aucun montant n'a été prélevé. Si vous le souhaitez, vous pouvez reprendre votre don en un clic, le formulaire est déjà rempli :",
            "",
            `Reprendre mon don : ${resumeUrl(payment)}`,
            "",
            second
                ? "C'est notre dernier message à ce sujet. Merci d'avoir pensé à nous !"
                : "Merci de votre générosité, et à bientôt.",
            `L'équipe ${ORG_NAME}`,
        ].join("\n"),
    };
}

exports.resumeUrl = resumeUrl;
exports.buildEmail = buildEmail;

// Un passage : relance les dons eligibles. Renvoie { checked, sent, skipped }.
exports.run = async ({ limit = BATCH } = {}) => {
    const rows = await fundraisingRepo.getAbandonedForReminder({
        firstHours: FIRST_HOURS, secondHours: SECOND_HOURS, maxDays: MAX_DAYS, limit,
    });
    const summary = { checked: rows.length, sent: 0, skipped: 0 };
    for (const row of rows) {
        const payment = await paymentRepo.findById(row.id);
        const email = payment?.entered_donor_email || payment?.donor_email;
        if (!email) {
            summary.skipped += 1;
            continue;
        }
        if (!(await preferences.canContact(email, "donation_reminders"))) {
            // Pas de consentement : la relance est consommee sans envoi (aucun nouvel essai).
            await fundraisingRepo.claimReminder(payment.id, row.reminder_count);
            summary.skipped += 1;
            continue;
        }
        if (!(await fundraisingRepo.claimReminder(payment.id, row.reminder_count))) continue;
        const second = row.reminder_count >= 1;
        const message = buildEmail(payment, { second });
        const footer = await preferences.unsubscribeFooter(email, "donation_reminders");
        await emailService.send({ to: email, subject: message.subject, text: footer ? `${message.text}\n\n${footer}` : message.text });
        await logService.log({
            userId: payment.user_id,
            action: "donation.reminder_sent",
            meta: { paymentId: payment.id, reminder: row.reminder_count + 1, status: payment.status },
        });
        summary.sent += 1;
    }
    return summary;
};
