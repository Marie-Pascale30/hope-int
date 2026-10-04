const bcrypt = require("bcryptjs");
const userRepo = require("../repositories/userRepository");
const logService = require("./activityLogService");
const { sendNewCredentialsEmail } = require("./emailService");
const { normalizeRoles, canGrantRoles } = require("@hope/shared/rbac");
const { badRequest, conflict, forbidden, notFound } = require("../utils/httpError");
const { FRONTEND_URL, generateTempPassword } = require("../utils/security");

function assertValidRoleSet(roles) {
    if (!roles.length) throw badRequest("Au moins un rôle est requis");
    if (roles.includes("admin") && roles.length > 1) {
        throw badRequest("Le rôle admin ne peut pas être combiné avec d'autres rôles");
    }
}

async function getTarget(id) {
    const target = await userRepo.findById(id);
    if (!target) throw notFound("Utilisateur introuvable");
    return target;
}

// L'acteur ne peut agir que sur un compte dont il possede deja tous les droits.
function assertCanManage(actor, target) {
    if (!canGrantRoles(actor.roles, target.roles)) {
        throw forbidden("Ce compte dispose de droits que vous n'avez pas : action réservée à un niveau supérieur");
    }
}

async function assertNotLastAdmin(target, { removingAdmin }) {
    if (removingAdmin && target.roles.includes("admin") && target.status === "active") {
        if ((await userRepo.countActiveAdmins()) <= 1) {
            throw forbidden("Impossible : c'est le dernier administrateur actif de la plateforme");
        }
    }
}

exports.list = async (filters, pagination = null) => {
    const result = await userRepo.getAll(filters, pagination);
    return pagination ? { ...result, page: pagination.page, pageSize: pagination.pageSize } : result;
};

exports.assertValidRoleSet = assertValidRoleSet;

exports.updateRoles = async (actor, targetId, rawRoles) => {
    const roles = normalizeRoles(rawRoles);
    assertValidRoleSet(roles);

    const target = await getTarget(targetId);
    if (Number(target.id) === Number(actor.id)) {
        throw forbidden("Vous ne pouvez pas modifier vos propres rôles");
    }
    assertCanManage(actor, target);
    if (!canGrantRoles(actor.roles, roles)) {
        throw forbidden("Vous ne pouvez pas attribuer un rôle disposant de droits que vous n'avez pas");
    }
    await assertNotLastAdmin(target, { removingAdmin: !roles.includes("admin") });

    await userRepo.updateRoles(target.id, roles);
    await logService.log({
        userId: actor.id,
        action: "admin.update_user_roles",
        meta: { targetUserId: target.id, from: target.roles, to: roles },
    });
    return userRepo.findById(target.id);
};

// Prepare un compte avec mot de passe provisoire (controles de roles compris), sans l'ecrire :
// l'appelant l'insere lui-meme (eventuellement dans une transaction) puis appelle finalizeNewAccount.
exports.prepareNewAccount = async (actor, { name, email, roles: rawRoles, phone, region }) => {
    const roles = normalizeRoles(rawRoles);
    assertValidRoleSet(roles);
    if (!canGrantRoles(actor.roles, roles)) {
        throw forbidden("Vous ne pouvez pas attribuer un rôle disposant de droits que vous n'avez pas");
    }
    const tempPassword = generateTempPassword();
    return {
        tempPassword,
        record: {
            name,
            email,
            password: await bcrypt.hash(tempPassword, 12),
            roles,
            phone,
            region,
            mustChangePassword: true,
        },
    };
};

// Apres ecriture (et commit) : envoi des identifiants et journal.
exports.finalizeNewAccount = async (actor, id, { record, tempPassword }, extraMeta = {}) => {
    const mail = await sendNewCredentialsEmail({
        to: record.email,
        fullName: record.name,
        password: tempPassword,
        loginUrl: `${FRONTEND_URL}/connexion`,
    });

    await logService.log({
        userId: actor.id,
        action: "admin.create_user",
        meta: { targetUserId: id, email: record.email, roles: record.roles, emailSent: Boolean(mail?.sent), ...extraMeta },
    });

    return {
        user: await userRepo.findById(id),
        emailStatus: mail,
        // Sans email envoye, le mot de passe provisoire est montre une seule fois a l'administrateur.
        tempPassword: mail?.sent ? undefined : tempPassword,
    };
};

// Cree un compte avec mot de passe provisoire a changer a la premiere connexion.
exports.createWithGeneratedPassword = async (actor, data) => {
    const prepared = await exports.prepareNewAccount(actor, data);
    if (await userRepo.findByEmail(prepared.record.email)) throw conflict("Un compte existe déjà avec cet email");
    const id = await userRepo.create(prepared.record);
    return exports.finalizeNewAccount(actor, id, prepared);
};

exports.updateProfile = async (actor, targetId, payload) => {
    const target = await getTarget(targetId);
    const isSelf = Number(target.id) === Number(actor.id);

    if (payload.status !== undefined && payload.status !== target.status) {
        if (isSelf) throw forbidden("Vous ne pouvez pas désactiver votre propre compte");
        assertCanManage(actor, target);
        await assertNotLastAdmin(target, { removingAdmin: payload.status !== "active" });
    }

    await userRepo.updateProfile(target.id, payload);
    if (payload.status === "inactive" && target.status !== "inactive") {
        await userRepo.bumpTokenVersion(target.id);
    }

    const fields = Object.keys(payload).filter((key) => payload[key] !== undefined);
    const statusChanged = payload.status !== undefined && payload.status !== target.status;
    await logService.log({
        userId: actor.id,
        action: "hr.update_profile",
        meta: {
            targetUserId: target.id,
            fields,
            ...(statusChanged ? { status: { from: target.status, to: payload.status } } : {}),
        },
    });
    return userRepo.findById(target.id);
};

exports.remove = async (actor, targetId) => {
    const target = await getTarget(targetId);
    if (Number(target.id) === Number(actor.id)) {
        throw forbidden("Vous ne pouvez pas supprimer votre propre compte");
    }
    assertCanManage(actor, target);
    await assertNotLastAdmin(target, { removingAdmin: true });

    await userRepo.remove(target.id);
    await logService.log({
        userId: actor.id,
        action: "admin.delete_user",
        meta: { targetUserId: target.id, email: target.email },
    });
};
