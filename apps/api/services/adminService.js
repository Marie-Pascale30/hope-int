const db = require("../config/db");
const statsRepo = require("../repositories/statsRepository");
const activityRepo = require("../repositories/activityLogRepository");
const contentRepo = require("../repositories/contentRepository");
const eventRepo = require("../repositories/eventRepository");
const userRepo = require("../repositories/userRepository");
const paymentService = require("./paymentService");
const { hasMailConfig } = require("./emailService");
const { getRoleMatrix, hasGlobalScope, PERMISSION_LABELS, ROLE_LABELS } = require("@hope/shared/rbac");
const { REGIONS } = require("@hope/shared/constants");
const { badRequest, forbidden } = require("../utils/httpError");

exports.getStats = async () => statsRepo.getDashboard();

exports.getLogs = async (filters) => activityRepo.getLatest(filters);

exports.getRoles = async () => ({
    roles: getRoleMatrix(),
    permissionLabels: PERMISSION_LABELS,
    roleLabels: ROLE_LABELS,
});

// Hors roles a portee globale, la vue regionale est limitee a la region de la fiche.
function resolveRegion(actor, requested) {
    if (hasGlobalScope(actor.roles)) {
        if (requested && !REGIONS.includes(requested)) throw badRequest("Région inconnue");
        return requested || null;
    }
    if (!actor.region) {
        throw forbidden("Aucune région n'est associée à votre fiche : demandez aux RH de la renseigner");
    }
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

exports.getAnnualReport = async (year) => {
    const targetYear = Number(year) || new Date().getFullYear();
    const [finance, activity, impact, years] = await Promise.all([
        paymentService.getSummary({ year: targetYear }),
        statsRepo.getYearActivity(targetYear),
        contentRepo.getImpactTotals(),
        statsRepo.getAvailableYears(),
    ]);
    return {
        year: targetYear,
        availableYears: years.includes(targetYear) ? years : [targetYear, ...years],
        finance,
        activity,
        impact,
        generatedAt: new Date().toISOString(),
    };
};

exports.getSystemStatus = async () => {
    const started = Date.now();
    let database = { ok: true };
    try {
        const [[row]] = await db.query("SELECT VERSION() AS version");
        database = { ok: true, version: row.version, latencyMs: Date.now() - started };
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
    ["currency", "Devise"],
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
    // Neutralise les formules (injection CSV dans Excel).
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Separateur ";" et BOM UTF-8 : ouverture directe dans Excel en francais.
exports.exportDonationsCsv = async (filters) => {
    const rows = await paymentService.getAll(filters);
    const lines = [
        CSV_COLUMNS.map(([, label]) => label).join(";"),
        ...rows.map((row) => CSV_COLUMNS.map(([key]) => {
            if (key === "amount") return String(row.amount).replace(".", ",");
            return csvCell(row[key]);
        }).join(";")),
    ];
    return `﻿${lines.join("\r\n")}`;
};
