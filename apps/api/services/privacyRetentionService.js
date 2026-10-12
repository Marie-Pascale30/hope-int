// Durees de conservation (purge quotidienne, durees configurables) :
// - email_outbox envoyes ou en echec depuis RETENTION_OUTBOX_DAYS (30 j) : corps et pieces jointes vides ;
// - journaux plus anciens que RETENTION_LOGS_MONTHS (12 mois) : emails, noms et telephones retires du detail ;
// - candidatures refusees depuis RETENTION_REFUSED_APPLICATIONS_MONTHS (24 mois) : supprimees ;
// - liens de reinitialisation expires et tentatives d'authentification de plus d'un jour : supprimes ;
// - recus conserves apres effacement d'un compte, au terme de ACCOUNTING_RETENTION_YEARS : nom et email vides.
const privacyRepo = require("../repositories/privacyRepository");
const logService = require("./activityLogService");

const setting = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

const durations = () => ({
    outboxDays: setting("RETENTION_OUTBOX_DAYS", 30),
    logsMonths: setting("RETENTION_LOGS_MONTHS", 12),
    refusedApplicationsMonths: setting("RETENTION_REFUSED_APPLICATIONS_MONTHS", 24),
});

const EMAIL_RE = /[^\s@"]+@[^\s@"]+\.[^\s@"]+/g;
const PERSONAL_KEY_RE = /(e-?mail|^to$|name$|^nom|phone|telephone|^ip$)/i;

// Retire les donnees personnelles d'un detail de journal (cles sensibles et emails dans les textes).
function scrubMeta(value, key = "") {
    if (Array.isArray(value)) return value.map((item) => scrubMeta(item));
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubMeta(v, k)]));
    }
    if (typeof value === "string") {
        if (PERSONAL_KEY_RE.test(key)) return "[anonymisé]";
        return value.replace(EMAIL_RE, "[anonymisé]");
    }
    return value;
}

exports.scrubMeta = scrubMeta;

async function anonymizeLogs(months) {
    let total = 0;
    for (let round = 0; round < 50; round += 1) {
        const rows = await privacyRepo.logsToAnonymize(months);
        if (!rows.length) break;
        for (const row of rows) {
            const meta = typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta;
            const scrubbed = meta && typeof meta === "object" && !Array.isArray(meta) ? scrubMeta(meta) : { value: scrubMeta(meta) };
            await privacyRepo.updateLogMeta(row.id, { ...scrubbed, _anonymized: true });
            total += 1;
        }
    }
    return total;
}

exports.runPurge = async () => {
    const config = durations();
    const counts = {
        outbox: await privacyRepo.purgeOutbox(config.outboxDays),
        logs: await anonymizeLogs(config.logsMonths),
        refusedApplications: await privacyRepo.deleteRefusedApplications(config.refusedApplicationsMonths),
        passwordResets: await privacyRepo.deleteExpiredPasswordResets(),
        authAttempts: await privacyRepo.deleteOldAuthAttempts(),
        retainedReceipts: await privacyRepo.purgeRetainedReceipts(),
    };
    await logService.log({ action: "privacy.retention_purge", meta: { ...counts, ...config, _anonymized: true } });
    return counts;
};

exports.durations = durations;
