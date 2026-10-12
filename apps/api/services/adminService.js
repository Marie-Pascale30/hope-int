const statsRepo = require("../repositories/statsRepository");
const activityRepo = require("../repositories/activityLogRepository");
const contentRepo = require("../repositories/contentRepository");
const eventRepo = require("../repositories/eventRepository");
const userRepo = require("../repositories/userRepository");
const paymentService = require("./paymentService");
const logService = require("./activityLogService");
const { hasMailConfig } = require("./emailService");
const { getRoleMatrix, hasGlobalScope, PERMISSION_LABELS, ROLE_LABELS } = require("@hope/shared/rbac");
const { REGIONS, XAF_PER_EUR } = require("@hope/shared/constants");
const { receiptYear } = require("../utils/timezone");
const { badRequest, forbidden } = require("../utils/httpError");
const { getScopeRegion, NO_REGION_MESSAGE } = require("../utils/scope");

// Statistiques : un acteur restreint a sa region ne voit que les chiffres de sa region.
exports.getStats = async (actor) => statsRepo.getDashboard({ region: getScopeRegion(actor) });

exports.getLogs = async (filters) => activityRepo.getLatest(filters);

exports.getRoles = async () => ({
    roles: getRoleMatrix(),
    permissionLabels: PERMISSION_LABELS,
    roleLabels: ROLE_LABELS,
});

// Hors roles a portee globale, la vue regionale est limitee a la region de la fiche
// (la route exige MANAGE_REGIONAL : un acteur non global y est donc restreint a sa region).
function resolveRegion(actor, requested) {
    if (hasGlobalScope(actor.roles)) {
        if (requested && !REGIONS.includes(requested)) throw badRequest("Région inconnue");
        return requested || null;
    }
    if (!actor.region) throw forbidden(NO_REGION_MESSAGE);
    return actor.region;
}

exports.getRegional = async (actor, requestedRegion) => {
    const region = resolveRegion(actor, requestedRegion);
    const [impact, projects, events, members, finance] = await Promise.all([
        contentRepo.getImpactTotals({ region }),
        contentRepo.getAll("projects", { region }),
        eventRepo.getAll({ region, upcomingOnly: true }),
        userRepo.getAll({ region }),
        paymentService.getSummary({ region }),
    ]);

    return {
        region,
        canChooseRegion: hasGlobalScope(actor.roles),
        regions: REGIONS,
        impact,
        projects,
        upcomingEvents: events,
        members: members.map(({ id, name, email, phone, roles, status, skills, availability }) => ({
            id, name, email, phone, roles, status, skills, availability,
        })),
        finance: {
            totalEur: finance.totalEur,
            count: finance.count,
            donors: finance.donors,
            byProject: finance.byProject,
        },
    };
};

// Impact de l'annee : les compteurs des projets sont des cumuls sans date ; on additionne
// ceux des projets actifs pendant l'annee (periode qui recoupe l'annee), ce qui est signale
// dans impactScope pour que le rapport ne le presente pas comme un impact strictement annuel.
exports.getAnnualReport = async (actor, year) => {
    // Annee civile du fuseau des recus (meme reference que les bornes du bilan).
    const targetYear = Number(year) || receiptYear(new Date());
    const region = getScopeRegion(actor);
    const [finance, activity, impact, years] = await Promise.all([
        paymentService.getSummary({ year: targetYear, ...(region ? { region } : {}) }),
        statsRepo.getYearActivity(targetYear, { region }),
        contentRepo.getImpactTotals({ region, activeInYear: targetYear }),
        statsRepo.getAvailableYears(),
    ]);
    return {
        year: targetYear,
        region: region || null,
        availableYears: years.includes(targetYear) ? years : [targetYear, ...years],
        finance,
        activity,
        impact,
        impactScope: {
            basis: "projects_active_in_year",
            note: "Cumuls déclarés des projets actifs pendant l'année (un projet pluriannuel compte dans chaque année couverte).",
        },
        generatedAt: new Date().toISOString(),
    };
};

// Bilan financier : limite a la region pour un acteur restreint.
exports.getFinanceSummary = async (actor, filters = {}) => {
    const region = getScopeRegion(actor);
    return paymentService.getSummary({ ...filters, ...(region ? { region } : {}) });
};

// Liste des dons : limitee a la region (dons affectes a un projet de la region) pour un acteur restreint.
// Renvoie { rows, total } (page demandee, ou les dons les plus recents sans pagination).
exports.getDonations = async (actor, filters = {}, pagination = null) => {
    const region = getScopeRegion(actor);
    return paymentService.getAll({ ...filters, ...(region ? { region } : {}) }, pagination);
};

exports.getSystemStatus = async () => {
    let database;
    try {
        database = { ok: true, ...(await statsRepo.getDatabaseInfo()) };
    } catch (error) {
        database = { ok: false, error: error.message };
    }

    const jwtSecret = process.env.JWT_SECRET || "";
    const providers = paymentService.getProviders();
    const checks = [
        {
            key: "jwt_secret",
            label: "Secret JWT robuste",
            ok: jwtSecret.length >= 32 && jwtSecret !== "change_me",
            hint: "Définir JWT_SECRET avec au moins 32 caractères aléatoires.",
        },
        { key: "stripe", label: "Paiement par carte (Stripe)", ok: providers.stripe, hint: "Renseigner STRIPE_SECRET_KEY." },
        {
            key: "stripe_webhook",
            label: "Webhook Stripe signé",
            ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
            hint: "Obligatoire en production : renseigner STRIPE_WEBHOOK_SECRET.",
        },
        {
            key: "mobile_money",
            label: "Mobile Money (prestataire actif)",
            ok: providers.mobileMoney,
            hint: "Configurer Notch Pay (NOTCHPAY_PUBLIC_KEY) ou Flutterwave (FLUTTERWAVE_SECRET_KEY).",
        },
        {
            key: "notchpay",
            label: "Notch Pay (Orange Money / MTN MoMo)",
            ok: providers.notchpay,
            hint: "Renseigner NOTCHPAY_PUBLIC_KEY (clé pk_test_... ou pk_...).",
        },
        {
            key: "notchpay_webhook",
            label: "Webhook Notch Pay",
            ok: Boolean(process.env.NOTCHPAY_WEBHOOK_HASH),
            hint: "Renseigner NOTCHPAY_WEBHOOK_HASH (clé de hachage du tableau de bord Notch Pay).",
        },
        {
            key: "flutterwave",
            label: "Mobile Money (Flutterwave)",
            ok: providers.flutterwave,
            hint: "Renseigner FLUTTERWAVE_SECRET_KEY (clé FLWSECK...).",
        },
        {
            key: "flutterwave_webhook",
            label: "Webhook Flutterwave",
            ok: Boolean(process.env.FLUTTERWAVE_WEBHOOK_HASH),
            hint: "Renseigner FLUTTERWAVE_WEBHOOK_HASH (même valeur que dans le tableau de bord Flutterwave).",
        },
        { key: "smtp", label: "Envoi d'emails (SMTP)", ok: hasMailConfig(), hint: "Renseigner SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS." },
        {
            key: "db_password",
            label: "Mot de passe base de données",
            ok: Boolean(process.env.DB_PASSWORD),
            hint: "Le compte MySQL n'a pas de mot de passe : acceptable en local uniquement.",
        },
    ];

    return {
        environment: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        database,
        tables: database.ok ? await statsRepo.getTableCounts() : {},
        reconcile: database.ok ? { lastRun: await paymentService.getLastReconcile() } : null,
        checks,
    };
};

const CSV_COLUMNS = [
    ["id", "ID"],
    ["receipt_number", "N° reçu"],
    ["paid_at", "Date de paiement"],
    ["created_at", "Date de création"],
    ["status", "Statut"],
    ["amount", "Montant"],
    ["refunded_amount", "Remboursé"],
    ["net_amount", "Net"],
    ["currency", "Devise"],
    ["net_eur", "Équivalent EUR"],
    ["method", "Moyen"],
    ["provider", "Prestataire"],
    ["frequency", "Fréquence"],
    ["donor_name", "Donateur"],
    ["donor_email", "Email"],
    ["project_title", "Affectation"],
    ["project_region", "Région"],
    ["transaction_id", "Référence prestataire"],
];

function csvCell(value) {
    if (value === null || value === undefined) return "";
    const text = value instanceof Date ? value.toISOString() : String(value);
    // Neutralise les formules (injection CSV dans Excel), y compris derriere une tabulation ou un retour chariot.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Montants avec virgule decimale (Excel en francais) : brut, rembourse, net et net converti en euros.
function csvAmounts(row) {
    const decimal = (value, digits) => Number(value).toFixed(digits).replace(".", ",");
    const digits = row.currency === "xaf" ? 0 : 2;
    const refunded = Number(row.refunded_amount || 0);
    const net = Number(row.amount) - refunded;
    return {
        amount: decimal(row.amount, digits),
        refunded_amount: decimal(refunded, digits),
        net_amount: decimal(net, digits),
        net_eur: decimal(row.currency === "xaf" ? net / XAF_PER_EUR : net, 2),
    };
}

exports.csvCell = csvCell;

// Separateur ";" et BOM UTF-8 : ouverture directe dans Excel en francais.
// Export complet (sans limite de lignes) et journalise : il contient des donnees personnelles.
exports.exportDonationsCsv = async (actor, filters = {}) => {
    const region = getScopeRegion(actor);
    const scoped = { ...filters, ...(region ? { region } : {}) };
    const rows = await paymentService.getForExport(scoped);
    await logService.log({
        userId: actor.id,
        action: "finance.export_donations",
        meta: { filters: scoped, rows: rows.length },
    });
    const lines = [
        CSV_COLUMNS.map(([, label]) => label).join(";"),
        ...rows.map((row) => {
            const amounts = csvAmounts(row);
            return CSV_COLUMNS.map(([key]) => (key in amounts ? amounts[key] : csvCell(row[key]))).join(";");
        }),
    ];
    // BOM UTF-8 : Excel detecte l'encodage et affiche correctement les accents.
    return `\uFEFF${lines.join("\r\n")}`;
};
