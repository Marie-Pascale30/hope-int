const { withTransaction } = require("../config/db");
const applicationRepo = require("../repositories/applicationRepository");
const userRepo = require("../repositories/userRepository");
const userService = require("./userService");
const logService = require("./activityLogService");
const emailService = require("./emailService");
const { normalizeRoles, canGrantRoles } = require("@hope/shared/rbac");
const { normalizeInterests } = require("@hope/shared/applications");
const { HttpError, conflict, forbidden, notFound } = require("../utils/httpError");
const { FRONTEND_URL } = require("../utils/security");

const ORG_NAME = process.env.ORG_NAME || "HOPE International Project";
const CLOSED_MESSAGE = "Cette candidature a déjà été clôturée";

// Emails d'information : jamais bloquants pour la reponse (ni en cas d'erreur SMTP).
function notify(sendPromise) {
    Promise.resolve(sendPromise).catch((error) => console.error("application-email-error:", error.message));
}

// Les poles d'interet sont indicatifs ; les roles demandes (ancien champ desiredRoles) sont ignores.
// Reponse identique quel que soit l'email (pas d'enumeration des comptes ni des candidatures) :
// - compte existant : rien n'est enregistre, le titulaire est prevenu par email ;
// - candidature deja ouverte : rien n'est enregistre (journalise).
// Renvoie l'id de la candidature creee, ou null.
exports.submit = async (payload) => {
    if (await applicationRepo.findOpenByEmail(payload.email)) {
        await logService.log({ action: "application.duplicate_ignored", meta: { email: payload.email } });
        return null;
    }
    const existing = await userRepo.findByEmail(payload.email);
    if (existing) {
        notify(emailService.send({
            to: existing.email,
            subject: `${ORG_NAME} - Votre candidature`,
            text: [
                `Bonjour ${existing.name},`,
                "",
                "Nous avons reçu une candidature avec votre adresse email, qui correspond déjà à un compte sur notre plateforme.",
                `Connectez-vous à votre espace (${FRONTEND_URL}/connexion) ; l'équipe peut aussi rattacher une nouvelle candidature à votre compte.`,
                "Si vous n'êtes pas à l'origine de cette démarche, vous pouvez ignorer ce message.",
            ].join("\n"),
        }));
        await logService.log({ userId: existing.id, action: "application.existing_account", meta: { email: payload.email } });
        return null;
    }

    const interests = normalizeInterests(payload.interests);
    const id = await applicationRepo.create({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        region: payload.region,
        motivation: payload.motivation,
        interests,
    });

    notify(emailService.sendApplicationReceivedEmail({ to: payload.email, fullName: payload.name }));
    await logService.log({ action: "application.submitted", meta: { applicationId: id, email: payload.email, interests } });
    return id;
};

exports.list = async (filters, pagination = null) => {
    const result = await applicationRepo.getAll(filters, pagination);
    return pagination ? { ...result, page: pagination.page, pageSize: pagination.pageSize } : result;
};

async function getOpen(id) {
    const application = await applicationRepo.findById(id);
    if (!application) throw notFound("Candidature introuvable");
    if (["acceptee", "refusee"].includes(application.status)) {
        throw closed();
    }
    return application;
}

exports.markReviewing = async (actor, id, reviewNote) => {
    await getOpen(id);
    if (!(await applicationRepo.updateReview(id, { status: "en_etude", reviewerId: actor.id, reviewNote }))) {
        throw closed();
    }
    await logService.log({ userId: actor.id, action: "application.reviewing", meta: { applicationId: id } });
    return applicationRepo.findById(id);
};

// Refus conditionnel (candidature encore ouverte) ; renvoie la candidature refusee, ou null si
// elle est introuvable ou deja close.
async function rejectOne(actor, id, reviewNote, meta = {}) {
    const application = await applicationRepo.findById(id);
    if (!application || ["acceptee", "refusee"].includes(application.status)) return null;
    if (!(await applicationRepo.updateReview(id, { status: "refusee", reviewerId: actor.id, reviewNote }))) return null;
    notify(emailService.sendApplicationDecisionEmail({ to: application.email, fullName: application.name, accepted: false, note: reviewNote }));
    await logService.log({ userId: actor.id, action: "application.rejected", meta: { applicationId: Number(id), ...meta } });
    return application;
}

exports.reject = async (actor, id, reviewNote) => {
    await getOpen(id);
    if (!(await rejectOne(actor, id, reviewNote))) throw closed();
    return applicationRepo.findById(id);
};

// Refus groupe : memes conditions que le refus unitaire ; les candidatures introuvables ou deja
// closes sont ignorees et comptees dans skipped.
exports.bulkReject = async (actor, ids, reviewNote) => {
    const unique = [...new Set(ids.map(Number))];
    const rejected = [];
    for (const id of unique) {
        if (await rejectOne(actor, id, reviewNote, { bulk: true })) rejected.push(id);
    }
    await logService.log({
        userId: actor.id,
        action: "application.bulk_rejected",
        meta: { requested: unique, rejected, skipped: unique.length - rejected.length },
    });
    return { rejected: rejected.length, skipped: unique.length - rejected.length };
};

function accountExists(application) {
    return new HttpError(409, "Un compte existe déjà avec cet email : vous pouvez y rattacher la candidature", {
        code: "ACCOUNT_EXISTS",
        details: { email: application.email },
    });
}

// Candidature deja acceptee ou refusee (decision concurrente ou ecran perime).
function closed() {
    return conflict(CLOSED_MESSAGE, { code: "APPLICATION_CLOSED" });
}

// Ecritures de l'acceptation dans une transaction (withTransaction) : le compte n'existe jamais
// sans la candidature acceptee, ni l'inverse.

async function closeAsAccepted(connection, actor, id, { reviewNote, userId }) {
    const updated = await applicationRepo.updateReview(
        id,
        { status: "acceptee", reviewerId: actor.id, reviewNote, userId },
        connection
    );
    // Decision concurrente (autre acceptation ou refus entre-temps) : tout est annule.
    if (!updated) throw closed();
}

// Rattachement a un compte existant et actif : mot de passe inchange, roles ajoutes seulement si
// l'acteur peut les attribuer (verifie avant l'appel) et possede deja tous les droits du compte.
async function acceptOnExistingAccount(actor, application, existing, { roles, reviewNote }) {
    if (existing.status !== "active") {
        throw forbidden("Ce compte est désactivé : réactivez-le avant d'y rattacher la candidature");
    }
    const merged = normalizeRoles([...existing.roles, ...roles]);
    const rolesChanged = merged.length !== existing.roles.length;
    if (rolesChanged) {
        if (Number(existing.id) === Number(actor.id)) throw forbidden("Vous ne pouvez pas modifier vos propres rôles");
        userService.assertCanManage(actor, existing);
        userService.assertValidRoleSet(merged);
    }

    await withTransaction(async (connection) => {
        if (rolesChanged) await userRepo.updateRoles(existing.id, merged, connection);
        await closeAsAccepted(connection, actor, application.id, { reviewNote, userId: existing.id });
    });

    notify(emailService.send({
        to: application.email,
        subject: `${ORG_NAME} - Votre candidature`,
        text: [
            `Bonjour ${application.name},`,
            "",
            "Bonne nouvelle : votre candidature a été acceptée et rattachée à votre compte existant.",
            "Connectez-vous avec vos identifiants habituels pour accéder à votre espace.",
            reviewNote ? `\nMessage de l'équipe : ${reviewNote}` : "",
        ].join("\n"),
    }));
    if (rolesChanged) {
        await logService.log({
            userId: actor.id,
            action: "admin.update_user_roles",
            meta: { targetUserId: existing.id, from: existing.roles, to: merged, applicationId: application.id },
        });
    }
    await logService.log({
        userId: actor.id,
        action: "application.accepted",
        meta: { applicationId: application.id, userId: existing.id, roles, linkedExisting: true },
    });
    return { user: await userRepo.findById(existing.id), linkedExisting: true };
}

async function acceptWithNewAccount(actor, application, { roles, reviewNote }) {
    const prepared = await userService.prepareNewAccount(actor, {
        name: application.name,
        email: application.email,
        roles,
        phone: application.phone,
        region: application.region,
    });

    let userId;
    try {
        userId = await withTransaction(async (connection) => {
            const id = await userRepo.create(prepared.record, connection);
            await closeAsAccepted(connection, actor, application.id, { reviewNote, userId: id });
            return id;
        });
    } catch (error) {
        // Compte cree entre-temps avec le meme email (contrainte UNIQUE).
        if (error.code === "ER_DUP_ENTRY") throw accountExists(application);
        throw error;
    }

    // Emails envoyes apres le commit uniquement.
    const result = await userService.finalizeNewAccount(actor, userId, prepared, { applicationId: application.id });
    notify(emailService.sendApplicationDecisionEmail({ to: application.email, fullName: application.name, accepted: true, note: reviewNote }));
    await logService.log({
        userId: actor.id,
        action: "application.accepted",
        meta: { applicationId: application.id, userId, roles: prepared.record.roles },
    });
    return { ...result, linkedExisting: false };
}

// Accepter = creer le compte (ou rattacher un compte existant sur demande explicite) avec les
// roles choisis par l'acteur : aucun role n'est deduit de la candidature.
exports.accept = async (actor, id, { roles: rawRoles, reviewNote, linkExisting = false } = {}) => {
    const roles = normalizeRoles(rawRoles);
    userService.assertValidRoleSet(roles);
    if (!canGrantRoles(actor.roles, roles)) {
        throw forbidden("Vous ne pouvez pas attribuer un rôle disposant de droits que vous n'avez pas");
    }

    const application = await getOpen(id);
    const existing = await userRepo.findByEmail(application.email);

    let result;
    if (!existing) {
        result = await acceptWithNewAccount(actor, application, { roles, reviewNote });
    } else if (linkExisting === true) {
        result = await acceptOnExistingAccount(actor, application, existing, { roles, reviewNote });
    } else {
        // L'interface propose alors le rattachement (linkExisting: true).
        throw accountExists(application);
    }

    return { application: await applicationRepo.findById(id), ...result };
};
