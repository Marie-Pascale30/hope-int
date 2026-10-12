const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { SESSION_TTL_SECONDS } = require("../config/session");
const userRepo = require("../repositories/userRepository");
const resetRepo = require("../repositories/passwordResetRepository");
const attemptRepo = require("../repositories/authAttemptRepository");
const logService = require("./activityLogService");
const { sendPasswordResetEmail, sendRegistrationAttemptEmail } = require("./emailService");
const { getPermissionsForRoles } = require("@hope/shared/rbac");
const { HttpError, badRequest, unauthorized } = require("../utils/httpError");
const { FRONTEND_URL, assertStrongPassword, randomToken, sha256 } = require("../utils/security");

const INVALID_CREDENTIALS = "Email ou mot de passe incorrect";
// Hash factice : la comparaison prend le meme temps que l'email existe ou non.
const DUMMY_HASH = bcrypt.hashSync("hope-dummy-password", 12);

// Limitation par compte (en plus de la limite par adresse IP des routes) : compteurs en base
// (table auth_attempts), partages entre instances de l'API. Fenetre glissante de 15 minutes :
// - connexion : 10 echecs pour un meme email bloquent les essais suivants (429) ;
// - mot de passe oublie : au-dela de 5 demandes, plus aucun email n'est envoye (reponse inchangee).
const ATTEMPT_WINDOW_MINUTES = 15;
const MAX_LOGIN_FAILURES = 10;
const MAX_RESET_REQUESTS = 5;

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
        { expiresIn: SESSION_TTL_SECONDS }
    );
}

// Inscription : reponse identique que l'email soit deja utilise ou non (pas d'enumeration des
// comptes). Si un compte existe, rien n'est modifie et son titulaire est prevenu par email.
// Le mot de passe est hache dans les deux cas pour un temps de reponse comparable.
exports.register = async ({ name, email, password }, locale = "fr") => {
    assertStrongPassword(password);
    const hash = await bcrypt.hash(password, 12);

    let existing = await userRepo.findByEmail(email);
    if (!existing) {
        try {
            const id = await userRepo.create({ name, email, password: hash, role: "membre", roles: ["membre"] });
            await logService.log({ userId: id, action: "auth.register", meta: { email } });
            return;
        } catch (error) {
            // Inscription concurrente avec le meme email (contrainte UNIQUE).
            if (error.code !== "ER_DUP_ENTRY") throw error;
            existing = await userRepo.findByEmail(email);
        }
    }

    const prefix = locale === "fr" ? "" : `/${locale}`;
    Promise.resolve(sendRegistrationAttemptEmail({
        to: existing.email,
        fullName: existing.name,
        loginUrl: `${FRONTEND_URL}${prefix}/connexion`,
        resetUrl: `${FRONTEND_URL}${prefix}/mot-de-passe-oublie`,
    })).catch((error) => console.error("register-email-error:", error.message));
    await logService.log({ userId: existing.id, action: "auth.register_existing", meta: { email } });
};

exports.login = async (email, password) => {
    const identifier = String(email || "").trim().toLowerCase();
    if ((await attemptRepo.countRecent("login", identifier, ATTEMPT_WINDOW_MINUTES)) >= MAX_LOGIN_FAILURES) {
        await logService.log({ action: "auth.login_throttled", meta: { email: identifier } });
        throw new HttpError(429, "Trop de tentatives sur ce compte : réessayez dans 15 minutes.", { code: "ACCOUNT_THROTTLED" });
    }

    const user = await userRepo.findByEmailWithPassword(email);
    const valid = await bcrypt.compare(password, user?.password || DUMMY_HASH);

    if (!user || !valid) {
        // Compte inexistant compris : le blocage ne revele pas si l'email est inscrit.
        await attemptRepo.record("login", identifier);
        await logService.log({ userId: user?.id || null, action: "auth.login_failed", meta: { email } });
        throw unauthorized(INVALID_CREDENTIALS);
    }
    if (user.status !== "active") {
        await logService.log({ userId: user.id, action: "auth.login_inactive", meta: { email: user.email } });
        throw unauthorized("Ce compte est désactivé. Contactez l'administration.");
    }

    await attemptRepo.clear("login", identifier);
    await userRepo.touchLogin(user.id);
    await logService.log({ userId: user.id, action: "auth.login", meta: { email: user.email } });

    return { token: signToken(user), user: toSessionUser(user) };
};

exports.getMe = async (userId) => {
    const user = await userRepo.findById(userId);
    return toSessionUser(user);
};

exports.updateMe = async (userId, { name, phone }) => {
    // Seuls les champs envoyes sont modifies (un champ absent ne doit pas etre ecrase).
    const changes = Object.fromEntries(Object.entries({ name, phone }).filter(([, value]) => value !== undefined));
    await userRepo.updateProfile(userId, changes);
    return exports.getMe(userId);
};

// "Se deconnecter partout" : toutes les sessions ouvertes (cookies et jetons) deviennent invalides.
exports.logoutAll = async (userId) => {
    await userRepo.bumpTokenVersion(userId);
    await logService.log({ userId, action: "auth.logout_all" });
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
// locale : langue du site de la demande, pour que le lien ouvre la page dans la meme langue.
exports.requestPasswordReset = async (email, locale = "fr") => {
    const identifier = String(email || "").trim().toLowerCase();
    const recent = await attemptRepo.countRecent("password_reset", identifier, ATTEMPT_WINDOW_MINUTES);
    await attemptRepo.record("password_reset", identifier);
    if (recent >= MAX_RESET_REQUESTS) {
        await logService.log({ action: "auth.password_reset_throttled", meta: { email: identifier } });
        return;
    }

    const user = await userRepo.findByEmail(email);
    if (!user || user.status !== "active") return;

    const token = randomToken(32);
    await resetRepo.create(user.id, sha256(token), 60);
    await sendPasswordResetEmail({
        to: user.email,
        fullName: user.name,
        resetUrl: `${FRONTEND_URL}${locale === "fr" ? "" : `/${locale}`}/reinitialiser-mot-de-passe?token=${token}`,
    });
    await logService.log({ userId: user.id, action: "auth.password_reset_requested" });
};

const invalidResetLink = () => badRequest("Ce lien est invalide ou a expiré. Faites une nouvelle demande.", { code: "RESET_LINK_INVALID" });

// Le lien est consomme atomiquement (UPDATE ... WHERE used_at IS NULL) avant le changement de mot
// de passe : deux utilisations simultanees ne peuvent pas aboutir toutes les deux.
exports.resetPassword = async (token, newPassword) => {
    const reset = await resetRepo.findValid(sha256(token));
    if (!reset) throw invalidResetLink();
    assertStrongPassword(newPassword);

    const hash = await bcrypt.hash(newPassword, 12);
    if (!(await resetRepo.markUsed(reset.id))) throw invalidResetLink();
    await userRepo.updatePassword(reset.user_id, hash);
    await logService.log({ userId: reset.user_id, action: "auth.password_reset" });
};
