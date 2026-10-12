// Droits RGPD en libre-service : export de "mes donnees" et effacement du compte.
// L'effacement anonymise le compte et les donnees personnelles, mais conserve les recus figes
// (champs receipt_*) pendant la duree comptable (ACCOUNTING_RETENTION_YEARS, 10 ans par defaut),
// apres arret des dons mensuels actifs. Le journal ne contient aucune donnee personnelle.
//
// Extension : un autre module peut ajouter ses donnees a l'export et a l'effacement :
//   privacyService.registerExporter("benevolat", async ({ userId, email }) => ({ ... }));
//   privacyService.registerEraser("benevolat", async ({ connection, userId, email, placeholderEmail }) => count);
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { withTransaction } = require("../config/db");
const privacyRepo = require("../repositories/privacyRepository");
const consentRepo = require("../repositories/consentRepository");
const userRepo = require("../repositories/userRepository");
const logService = require("./activityLogService");
const { getPermissionsForRoles } = require("@hope/shared/rbac");
const { badRequest, conflict, forbidden, notFound } = require("../utils/httpError");

const exporters = new Map();
const erasers = new Map();

exports.registerExporter = (name, fn) => exporters.set(name, fn);
exports.registerEraser = (name, fn) => erasers.set(name, fn);

const retentionYears = () => {
    const value = Number(process.env.ACCOUNTING_RETENTION_YEARS || 10);
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 10;
};
exports.retentionYears = retentionYears;

const parseJson = (value) => {
    if (!value || typeof value !== "string") return value ?? null;
    try {
        return JSON.parse(value);
    } catch (_error) {
        return value;
    }
};

exports.exportFor = async (user) => {
    const profile = await privacyRepo.profile(user.id);
    if (!profile) throw notFound("Utilisateur introuvable");
    const identity = { userId: user.id, email: profile.email };
    const data = {
        generatedAt: new Date().toISOString(),
        profile: { ...profile, roles: parseJson(profile.roles) },
        donations: await privacyRepo.donations(identity),
        eventRegistrations: await privacyRepo.eventRegistrations(user.id),
        applications: (await privacyRepo.applications(identity)).map((row) => ({ ...row, interests: parseJson(row.interests) })),
        messages: await privacyRepo.messages(profile.email),
        consents: await consentRepo.historyFor(identity),
    };
    for (const [name, fn] of exporters) {
        try {
            data[name] = await fn(identity);
        } catch (error) {
            console.error(`privacy-export-${name}:`, error.message);
        }
    }
    await logService.log({ userId: user.id, action: "privacy.export" });
    return data;
};

// Les comptes de l'equipe doivent d'abord perdre leurs roles (continuite de service, dernier admin).
function assertErasable(account) {
    if (!account) throw notFound("Utilisateur introuvable");
    if (getPermissionsForRoles(account.roles).length > 0) {
        throw forbidden("Compte de l'équipe : demandez d'abord le retrait de vos rôles à l'administration");
    }
}

// Arret des dons mensuels actifs (facade des paiements). En cas d'echec, rien n'est efface.
// Seuls les dons mensuels rattaches au compte sont vus par la facade (getForUser).
async function stopSubscriptions(user) {
    const paymentService = require("./paymentService");
    const { subscriptions = [] } = await paymentService.getForUser(user);
    const toStop = subscriptions.filter((s) => !["canceled", "incomplete_expired"].includes(s.status));
    let stopped = 0;
    for (const subscription of toStop) {
        try {
            await paymentService.cancelSubscription(user, subscription.id);
            stopped += 1;
        } catch (error) {
            console.error("privacy-erasure-subscription:", error.message);
            throw conflict(
                "Impossible d'arrêter vos dons mensuels pour le moment : réessayez plus tard ou contactez-nous.",
                { code: "SUBSCRIPTION_STOP_FAILED" }
            );
        }
    }
    return stopped;
}

// Effacement demande par le titulaire : mot de passe et confirmation explicite exiges.
exports.eraseAccount = async (user, { password, confirmation }) => {
    if (confirmation !== true) throw badRequest("Confirmez la suppression définitive de vos données");
    const account = await userRepo.findById(user.id);
    assertErasable(account);
    const hash = await userRepo.findPasswordHashById(user.id);
    if (!hash || !(await bcrypt.compare(String(password || ""), hash))) throw badRequest("Mot de passe actuel incorrect");

    const identity = { userId: account.id, email: account.email };
    const subscriptionsStopped = await stopSubscriptions(account);

    const placeholderEmail = `deleted-${account.id}-${crypto.randomBytes(4).toString("hex")}@deleted.invalid`;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    const years = retentionYears();

    const summary = await withTransaction(async (connection) => {
        const payments = await privacyRepo.anonymizePayments(connection, identity);
        await privacyRepo.retainReceipts(connection, payments.receiptIds, years);
        const related = await privacyRepo.eraseRelated(connection, { ...identity, placeholderEmail });
        for (const [name, fn] of erasers) {
            related[name] = await fn({ connection, ...identity, placeholderEmail });
        }
        await privacyRepo.anonymizeUser(connection, account.id, { placeholderEmail, passwordHash });
        return { payments: payments.count, receiptsRetained: payments.receiptIds.length, ...related };
    });

    // Aucune donnee personnelle dans le journal : uniquement des compteurs.
    await logService.log({
        userId: account.id,
        action: "privacy.erasure",
        meta: { subscriptionsStopped, retentionYears: years, ...summary },
    });
    return { subscriptionsStopped, receiptsRetained: summary.receiptsRetained, retentionYears: years };
};
