const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userRepo = require("../repositories/userRepository");
const resetRepo = require("../repositories/passwordResetRepository");
const logService = require("./activityLogService");
const { sendPasswordResetEmail } = require("./emailService");
const { getPermissionsForRoles } = require("@hope/shared/rbac");
const { badRequest, conflict, unauthorized } = require("../utils/httpError");
const { FRONTEND_URL, assertStrongPassword, randomToken, sha256 } = require("../utils/security");

const INVALID_CREDENTIALS = "Email ou mot de passe incorrect";
// Hash factice : la comparaison prend le meme temps que l'email existe ou non.
const DUMMY_HASH = bcrypt.hashSync("hope-dummy-password", 12);

function toSessionUser(user) {
    const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role];
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        region: user.region || null,
        role: roles[0],
        roles,
        permissions: getPermissionsForRoles(roles),
        mustChangePassword: Boolean(user.must_change_password),
    };
}

function signToken(user) {
    return jwt.sign(
        { id: user.id, tv: Number(user.token_version || 0) },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
    );
}

exports.register = async ({ name, email, password }) => {
    assertStrongPassword(password);
    const exists = await userRepo.findByEmail(email);
    if (exists) throw conflict("Un compte existe déjà avec cet email");

    const hash = await bcrypt.hash(password, 12);
    const id = await userRepo.create({ name, email, password: hash, role: "membre", roles: ["membre"] });

    await logService.log({ userId: id, action: "auth.register", meta: { email } });
};

exports.login = async (email, password) => {
    const user = await userRepo.findByEmailWithPassword(email);
    const valid = await bcrypt.compare(password, user?.password || DUMMY_HASH);

    if (!user || !valid) {
        await logService.log({ userId: user?.id || null, action: "auth.login_failed", meta: { email } });
        throw unauthorized(INVALID_CREDENTIALS);
    }
    if (user.status !== "active") {
        throw unauthorized("Ce compte est désactivé. Contactez l'administration.");
    }

    await userRepo.touchLogin(user.id);
    await logService.log({ userId: user.id, action: "auth.login", meta: { email: user.email } });

    return { token: signToken(user), user: toSessionUser(user) };
};

exports.getMe = async (userId) => {
    const user = await userRepo.findById(userId);
    return toSessionUser(user);
};

exports.updateMe = async (userId, { name, phone }) => {
    await userRepo.updateProfile(userId, { name, phone });
    return exports.getMe(userId);
};

exports.changePassword = async (userId, { currentPassword, newPassword }) => {
    const hash = await userRepo.findPasswordHashById(userId);
    if (!hash || !(await bcrypt.compare(currentPassword || "", hash))) {
        throw badRequest("Mot de passe actuel incorrect");
    }
    if (currentPassword === newPassword) {
        throw badRequest("Le nouveau mot de passe doit être différent de l'actuel");
    }
    assertStrongPassword(newPassword);

    await userRepo.updatePassword(userId, await bcrypt.hash(newPassword, 12));
    await logService.log({ userId, action: "auth.password_changed" });

    // Les anciens jetons sont invalides (token_version incremente) : on en renvoie un neuf.
    const user = await userRepo.findAuthById(userId);
    return { token: signToken(user), user: await exports.getMe(userId) };
};

// Reponse identique que l'email existe ou non, pour ne pas reveler les comptes.
exports.requestPasswordReset = async (email) => {
    const user = await userRepo.findByEmail(email);
    if (!user || user.status !== "active") return;

    const token = randomToken(32);
    await resetRepo.create(user.id, sha256(token), 60);
    await sendPasswordResetEmail({
        to: user.email,
        fullName: user.name,
        resetUrl: `${FRONTEND_URL}/reinitialiser-mot-de-passe?token=${token}`,
    });
    await logService.log({ userId: user.id, action: "auth.password_reset_requested" });
};

exports.resetPassword = async (token, newPassword) => {
    const reset = await resetRepo.findValid(sha256(token));
    if (!reset) throw badRequest("Ce lien est invalide ou a expiré. Faites une nouvelle demande.");
    assertStrongPassword(newPassword);

    await userRepo.updatePassword(reset.user_id, await bcrypt.hash(newPassword, 12));
    await resetRepo.markUsed(reset.id);
    await logService.log({ userId: reset.user_id, action: "auth.password_reset" });
};
