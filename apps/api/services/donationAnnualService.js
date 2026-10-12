// Recapitulatifs fiscaux annuels : en janvier, chaque compte ayant des dons confirmes l'annee
// precedente recoit le PDF annuel (generateAnnual). Envoi par lots via la file d'emails, reprise
// possible (un marqueur par compte et par annee), campagne marquee terminee une seule fois par
// annee. La finance peut aussi lancer (ou poursuivre) l'envoi a la main.
const paymentRepo = require("../repositories/paymentRepository");
const fundraisingRepo = require("../repositories/fundraisingRepository");
const receiptService = require("./receiptService");
const emailService = require("./emailService");
const logService = require("./activityLogService");
const { dateParts } = require("../utils/timezone");
const { badRequest } = require("../utils/httpError");
const { FRONTEND_URL } = require("../utils/security");

const ORG_NAME = process.env.ORG_NAME || "HOPE International";
// Comptes traites par passage : la file d'emails absorbe l'envoi, la generation PDF reste bornee.
const BATCH = Number(process.env.ANNUAL_SUMMARY_BATCH || 25);

function email(user, year) {
    return {
        subject: `${ORG_NAME} - Récapitulatif de vos dons ${year}`,
        text: [
            `Bonjour ${user.name},`,
            "",
            `Merci pour votre soutien en ${year} ! Vous trouverez ci-joint le récapitulatif de vos dons confirmés de l'année, utile pour votre déclaration fiscale.`,
            `Il est aussi téléchargeable à tout moment depuis votre espace membre : ${FRONTEND_URL}/espace`,
            "",
            `L'équipe ${ORG_NAME}`,
        ].join("\n"),
    };
}

// Un lot pour l'annee donnee. Renvoie { year, sent, failed, remaining, completed }.
async function runBatch(year, { limit = BATCH, source = "worker", actorId = null } = {}) {
    const recipients = await fundraisingRepo.getAnnualSummaryRecipients(year, limit);
    const { from, to } = receiptService.yearBounds(year);
    let sent = 0;
    let failed = 0;
    for (const user of recipients) {
        // Marqueur pose avant l'envoi : un autre passage ne reprend pas ce compte.
        if (!(await fundraisingRepo.claimMarker("annual_summary", `${year}:${user.id}`))) continue;
        try {
            const payments = await paymentRepo.getSucceededByUserBetween(user.id, from, to);
            if (!payments.length) continue;
            const buffer = await receiptService.generateAnnual({ year, donorName: user.name, donorEmail: user.email, payments });
            const message = email(user, year);
            await emailService.send({
                to: user.email,
                subject: message.subject,
                text: message.text,
                attachments: [{ filename: `recapitulatif-dons-${year}.pdf`, content: buffer, contentType: "application/pdf" }],
            });
            sent += 1;
        } catch (error) {
            // Echec (PDF, base) : le compte sera repris au passage suivant.
            failed += 1;
            await fundraisingRepo.releaseMarker("annual_summary", `${year}:${user.id}`);
            console.error(`annual-summary-error user #${user.id}:`, error.message);
        }
    }
    const remaining = (await fundraisingRepo.getAnnualSummaryRecipients(year, 1)).length;
    let completed = false;
    if (!remaining && !failed) completed = await fundraisingRepo.claimMarker("annual_run", String(year));
    if (sent || completed) {
        await logService.log({ userId: actorId, action: "donation.annual_summaries", meta: { year, sent, failed, completed, source } });
    }
    return { year, sent, failed, remaining: remaining > 0, completed };
}

exports.runBatch = runBatch;

// Worker : uniquement en janvier (fuseau des recus), pour l'annee precedente, tant que la campagne
// n'est pas marquee terminee.
exports.runScheduled = async ({ now = new Date() } = {}) => {
    const { year, month } = dateParts(now);
    if (month !== "01") return null;
    const target = year - 1;
    if (await fundraisingRepo.hasMarker("annual_run", String(target))) return null;
    return runBatch(target);
};

// Etat de la campagne d'une annee (Finance).
exports.status = async (year) => {
    const value = Number(year);
    return {
        year: value,
        recipients: await fundraisingRepo.countAnnualSummaryRecipients(value),
        sent: await fundraisingRepo.countMarkers("annual_summary", `${value}:`),
        completed: await fundraisingRepo.hasMarker("annual_run", String(value)),
    };
};

// Declenchement manuel (finance) : un lot par appel, a repeter tant que "remaining" est vrai.
exports.trigger = async (actor, year) => {
    const value = Number(year);
    const current = receiptService.receiptYear(new Date());
    if (!Number.isInteger(value) || value < 2000 || value >= current) throw badRequest("Année invalide");
    return runBatch(value, { source: "manual", actorId: actor.id });
};
