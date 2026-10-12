// Attestations de benevolat : emission a la demande du membre (periode), PDF et verification
// publique par code (nom, periode, heures ; aucune autre donnee personnelle).
const crypto = require("crypto");
const certificateRepo = require("../repositories/certificateRepository");
const certificatePdf = require("./certificatePdf");
const volunteerService = require("./volunteerService");
const logService = require("./activityLogService");
const { badRequest, notFound } = require("../utils/httpError");
const {
    CERTIFICATE_CODE_ALPHABET, earnedBadgeKeys, normalizeCertificateCode,
} = require("@hope/shared/volunteering");

function randomCode() {
    const bytes = crypto.randomBytes(12);
    const chars = Array.from(bytes, (byte) => CERTIFICATE_CODE_ALPHABET[byte % CERTIFICATE_CODE_ALPHABET.length]).join("");
    return `HOPE-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Vue de l'attestation pour son titulaire.
const ownerView = (certificate) => ({
    code: certificate.code,
    holder_name: certificate.holder_name,
    period_start: certificate.period_start,
    period_end: certificate.period_end,
    total_hours: certificate.total_hours,
    event_hours: certificate.event_hours,
    other_hours: certificate.other_hours,
    events_count: certificate.events_count,
    missions_count: certificate.missions_count,
    badges: certificate.badges,
    issued_at: certificate.issued_at,
});

// Periode : jours locaux inclus. Par defaut, du premier engagement a aujourd'hui.
exports.issue = async (user, { from, to } = {}) => {
    const today = volunteerService.localDay();
    const toDate = to || today;
    if ((from && !DAY_PATTERN.test(from)) || !DAY_PATTERN.test(toDate)) throw badRequest("Période invalide");
    if (toDate > today) throw badRequest("La période ne peut pas se terminer dans le futur");

    let fromDate = from;
    if (!fromDate) {
        const { totals } = await volunteerService.buildSummary(user.id, { toDate });
        fromDate = totals.firstActivityAt ? volunteerService.localDay(totals.firstActivityAt) : toDate;
    }
    if (fromDate > toDate) throw badRequest("Période invalide");

    const { totals } = await volunteerService.buildSummary(user.id, { fromDate, toDate });
    if (!(totals.hours > 0)) throw badRequest("Aucune heure de bénévolat sur cette période");

    const existing = await certificateRepo.findSame({ userId: user.id, periodStart: fromDate, periodEnd: toDate, totalHours: totals.hours });
    if (existing) return ownerView(existing);

    // Badges acquis a la fin de la periode (historique complet jusqu'a cette date).
    const { totals: cumulative } = await volunteerService.buildSummary(user.id, { toDate });
    const badges = earnedBadgeKeys(cumulative, new Date(`${toDate}T23:59:59Z`));
    const holderName = (await certificateRepo.findUserName(user.id)) || user.name;

    let id = null;
    for (let attempt = 0; attempt < 5 && !id; attempt += 1) {
        try {
            id = await certificateRepo.create({
                code: randomCode(),
                userId: user.id,
                holderName,
                periodStart: fromDate,
                periodEnd: toDate,
                totalHours: totals.hours,
                eventHours: totals.eventHours,
                otherHours: totals.otherHours,
                eventsCount: totals.events,
                missionsCount: totals.missions,
                badges,
            });
        } catch (error) {
            if (error.code !== "ER_DUP_ENTRY") throw error;
        }
    }
    if (!id) throw new Error("Impossible de générer un code d'attestation unique");
    const certificate = await certificateRepo.findById(id);
    await logService.log({
        userId: user.id,
        action: "volunteer.certificate_issue",
        meta: { code: certificate.code, from: fromDate, to: toDate, hours: totals.hours },
    });
    return ownerView(certificate);
};

exports.listMine = async (user) => (await certificateRepo.listForUser(user.id)).map(ownerView);

// PDF d'une attestation du membre connecte.
exports.getPdf = async (user, code) => {
    const normalized = normalizeCertificateCode(code);
    const certificate = normalized ? await certificateRepo.findByCode(normalized) : null;
    if (!certificate || certificate.user_id !== user.id) throw notFound("Attestation introuvable");
    return { buffer: await certificatePdf.generate(certificate), code: certificate.code };
};

// Verification publique : seulement ce qui figure deja sur le document.
exports.verify = async (code) => {
    const normalized = normalizeCertificateCode(code);
    const certificate = normalized ? await certificateRepo.findByCode(normalized) : null;
    if (!certificate) throw notFound("Attestation introuvable");
    return {
        valid: true,
        code: certificate.code,
        holder_name: certificate.holder_name,
        period_start: certificate.period_start,
        period_end: certificate.period_end,
        total_hours: certificate.total_hours,
        issued_at: certificate.issued_at,
    };
};
