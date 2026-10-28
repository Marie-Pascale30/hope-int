const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { SESSION_TTL_SECONDS } = require("../config/session");
const userRepo = require("../repositories/userRepository");
const resetRepo = require("../repositories/passwordResetRepository");
const attemptRepo = require("../repositories/authAttemptRepository");
const challengeRepo = require("../repositories/loginChallengeRepository");
const logService = require("./activityLogService");
const consentService = require("./consentService");
const emailService = require("./emailService");
const { PERMISSIONS, getPermissionsForRoles } = require("@hope/shared/rbac");
const { GUEST_ROLE } = require("@hope/shared/volunteering");
const { HttpError, badRequest, unauthorized } = require("../utils/httpError");
const { FRONTEND_URL, assertStrongPassword, randomToken, sha256 } = require("../utils/security");
const { DEVICE_TTL_DAYS } = require("../utils/deviceCookie");

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

// Double authentification des comptes de l'equipe (permission access_admin_dashboard) : apres un
// mot de passe correct depuis un appareil non reconnu, un code a 6 chiffres est envoye par email.
// - code valable 10 minutes, a usage unique, stocke sous forme d'empreinte (HMAC lie au defi) ;
// - 5 codes errones invalident le defi (et comptent comme echecs de connexion du compte) ;
// - renvoi possible apres 60 s ; 5 envois au plus par compte sur 15 minutes.
const CODE_TTL_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODE_SENDS = 5;

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

// Prefixe d'URL du site selon la langue (francais sans prefixe).
const localePrefix = (locale) => (locale === "fr" ? "" : `/${locale}`);

// Inscription : reponse identique que l'email soit deja utilise ou non (pas d'enumeration des
// comptes). Si un compte existe, rien n'est modifie et son titulaire est prevenu par email.
// Un compte cree ici est invite (non-membre, peut etre benevole) ; il devient membre quand
// l'equipe accepte sa candidature (/rejoindre). Il recoit un email de bienvenue.
// Le mot de passe est hache dans les deux cas pour un temps de reponse comparable.
// consents (facultatif) : cases de consentement du formulaire ({ newsletter: true, ... }),
// enregistrees seulement pour un compte reellement cree (jamais pour un compte existant).
exports.register = async ({ name, email, password, consents }, locale = "fr") => {
    assertStrongPassword(password);
    const hash = await bcrypt.hash(password, 12);

    let existing = await userRepo.findByEmail(email);
    if (!existing) {
        try {
            const id = await userRepo.create({ name, email, password: hash, role: GUEST_ROLE, roles: [GUEST_ROLE] });
            await logService.log({ userId: id, action: "auth.register", meta: { email } });
            await consentService.recordFromForm({ email, userId: id, consents, source: "register", locale })
                .catch((error) => console.error("register-consents-error:", error.message));
            // Non attendu, comme pour un compte existant : meme temps de reponse dans les deux cas.
            const prefix = localePrefix(locale);
            Promise.resolve(emailService.sendWelcomeEmail({
                to: email,
                fullName: name,
                loginUrl: `${FRONTEND_URL}${prefix}/connexion`,
                eventsUrl: `${FRONTEND_URL}${prefix}/evenements`,
                joinUrl: `${FRONTEND_URL}${prefix}/rejoindre`,
            })).catch((error) => console.error("register-email-error:", error.message));
            return;
        } catch (error) {
            // Inscription concurrente avec le meme email (contrainte UNIQUE).
            if (error.code !== "ER_DUP_ENTRY") throw error;
            existing = await userRepo.findByEmail(email);
        }
    }

    const prefix = localePrefix(locale);
    Promise.resolve(emailService.sendRegistrationAttemptEmail({
        to: existing.email,
        fullName: existing.name,
        loginUrl: `${FRONTEND_URL}${prefix}/connexion`,
        resetUrl: `${FRONTEND_URL}${prefix}/mot-de-passe-oublie`,
    })).catch((error) => console.error("register-email-error:", error.message));
    await logService.log({ userId: existing.id, action: "auth.register_existing", meta: { email } });
};

// deviceToken : cookie "appareil de confiance" (comptes de l'equipe), facultatif.
// Renvoie { token, user } (session ouverte) ou, pour un compte de l'equipe sur un appareil non
// reconnu, { mfaRequired, challenge, ... } : la session ne s'ouvre qu'apres verifyLoginCode.
exports.login = async (email, password, { deviceToken = null } = {}) => {
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

    if (isStaff(user)) {
        const trusted = deviceToken && await challengeRepo.isTrustedDevice({
            userId: user.id,
            tokenHash: sha256(deviceToken),
            tokenVersion: Number(user.token_version || 0),
        });
        if (!trusted) return startLoginChallenge(user);
    }

    return exports.openSession(user);
};

const isStaff = (user) => getPermissionsForRoles(user.roles || [user.role]).includes(PERMISSIONS.ACCESS_ADMIN_DASHBOARD);

// Empreinte du code, liee au defi : un code n'est valable que pour la connexion qui l'a recu.
// HMAC (cle JWT_SECRET) : une copie de la base ne suffit pas a retrouver les codes par essais.
exports.hashLoginCode = (challengeTokenHash, code) =>
    crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${challengeTokenHash}:${code}`).digest("hex");

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

const challengeResponse = (challenge) => ({
    mfaRequired: true,
    challenge,
    expiresIn: CODE_TTL_MINUTES * 60,
    resendIn: RESEND_COOLDOWN_SECONDS,
});

const invalidChallenge = () => badRequest("Ce code a expiré ou n'est plus valable. Reconnectez-vous.", { code: "LOGIN_CODE_EXPIRED" });

// Limite d'envois par compte (connexions et renvois confondus), partagee entre instances.
async function assertCodeSendAllowed(user) {
    const identifier = `user:${user.id}`;
    if ((await attemptRepo.countRecent("login_code", identifier, ATTEMPT_WINDOW_MINUTES)) >= MAX_CODE_SENDS) {
        await logService.log({ userId: user.id, action: "auth.mfa_throttled", meta: { email: user.email } });
        throw new HttpError(429, "Trop de codes envoyés : réessayez dans 15 minutes.", { code: "LOGIN_CODE_THROTTLED" });
    }
    await attemptRepo.record("login_code", identifier);
}

// Le code part par la file d'emails ; il n'apparait ni dans les journaux ni dans la reponse.
async function sendLoginCode(user, code) {
    await emailService.sendLoginCodeEmail({ to: user.email, fullName: user.name, code, ttlMinutes: CODE_TTL_MINUTES });
    await logService.log({ userId: user.id, action: "auth.mfa_sent", meta: { email: user.email } });
}

async function startLoginChallenge(user) {
    await assertCodeSendAllowed(user);
    const challenge = randomToken(32);
    const tokenHash = sha256(challenge);
    const code = generateCode();
    await challengeRepo.createChallenge({
        userId: user.id,
        tokenHash,
        codeHash: exports.hashLoginCode(tokenHash, code),
        ttlMinutes: CODE_TTL_MINUTES,
    });
    await sendLoginCode(user, code);
    return challengeResponse(challenge);
}

// Defi actif et compte toujours actif, sinon erreur "code expire" (meme reponse dans tous les cas).
async function loadChallenge(challenge) {
    const row = await challengeRepo.findActive(sha256(challenge), MAX_CODE_ATTEMPTS);
    const user = row && await userRepo.findAuthById(row.user_id);
    if (!row || !user || user.status !== "active") throw invalidChallenge();
    return { row, user };
}

// Seconde etape : code recu par email. trustDevice : l'appareil n'aura plus besoin de code
// pendant 30 jours (deviceToken a poser en cookie par le controleur).
exports.verifyLoginCode = async ({ challenge, code, trustDevice = false, userAgent = null }) => {
    const { row, user } = await loadChallenge(challenge);
    const identifier = String(user.email).toLowerCase();
    if ((await attemptRepo.countRecent("login", identifier, ATTEMPT_WINDOW_MINUTES)) >= MAX_LOGIN_FAILURES) {
        await logService.log({ userId: user.id, action: "auth.login_throttled", meta: { email: identifier } });
        throw new HttpError(429, "Trop de tentatives sur ce compte : réessayez dans 15 minutes.", { code: "ACCOUNT_THROTTLED" });
    }

    const expected = Buffer.from(row.code_hash, "hex");
    const given = Buffer.from(exports.hashLoginCode(sha256(challenge), String(code)), "hex");
    if (!crypto.timingSafeEqual(expected, given)) {
        const attempts = await challengeRepo.recordFailure(row.id, MAX_CODE_ATTEMPTS);
        await attemptRepo.record("login", identifier);
        await logService.log({ userId: user.id, action: "auth.mfa_failed", meta: { email: user.email, attempts } });
        if (attempts >= MAX_CODE_ATTEMPTS) throw invalidChallenge();
        throw badRequest("Code incorrect. Vérifiez le dernier code reçu par email.", {
            code: "LOGIN_CODE_INVALID",
            details: { attemptsLeft: MAX_CODE_ATTEMPTS - attempts },
        });
    }

    // Deux validations simultanees du meme code : une seule ouvre une session.
    if (!(await challengeRepo.consume(row.id, MAX_CODE_ATTEMPTS))) throw invalidChallenge();
    await attemptRepo.clear("login", identifier);

    let deviceToken = null;
    if (trustDevice) {
        deviceToken = randomToken(32);
        await challengeRepo.createTrustedDevice({
            userId: user.id,
            tokenHash: sha256(deviceToken),
            tokenVersion: Number(user.token_version || 0),
            userAgent,
            ttlDays: DEVICE_TTL_DAYS,
        });
    }
    await logService.log({ userId: user.id, action: "auth.mfa_verified", meta: { email: user.email, trustDevice: Boolean(trustDevice) } });

    return { ...(await exports.openSession(user)), deviceToken };
};

// Nouveau code pour la meme connexion (l'ancien n'est plus valable).
exports.resendLoginCode = async (challenge) => {
    const { row, user } = await loadChallenge(challenge);
    const cooldown = (seconds) => new HttpError(429, "Patientez avant de demander un nouveau code.", {
        code: "LOGIN_CODE_COOLDOWN",
        details: { retryAfter: Math.max(1, seconds) },
    });
    const wait = RESEND_COOLDOWN_SECONDS - Number(row.seconds_since_sent || 0);
    if (wait > 0) throw cooldown(wait);

    await assertCodeSendAllowed(user);
    const tokenHash = sha256(challenge);
    const code = generateCode();
    if (!(await challengeRepo.replaceCode(row.id, exports.hashLoginCode(tokenHash, code), CODE_TTL_MINUTES, RESEND_COOLDOWN_SECONDS))) {
        throw cooldown(RESEND_COOLDOWN_SECONDS);
    }
    await sendLoginCode(user, code);
    return { expiresIn: CODE_TTL_MINUTES * 60, resendIn: RESEND_COOLDOWN_SECONDS };
};

// Session ouverte apres authentification (mot de passe correct).
exports.openSession = async (user) => {
    const fresh = (await userRepo.findAuthById(user.id)) || user;
    await userRepo.touchLogin(fresh.id);
    await logService.log({ userId: fresh.id, action: "auth.login", meta: { email: fresh.email } });
    return { token: signToken(fresh), user: await exports.getMe(fresh.id) };
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
    // token_version suffit a invalider les appareils de confiance ; la revocation garde un etat lisible.
    await challengeRepo.revokeTrustedDevices(userId);
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
    await challengeRepo.revokeTrustedDevices(userId);
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
    await emailService.sendPasswordResetEmail({
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
    await challengeRepo.revokeTrustedDevices(reset.user_id);
    await logService.log({ userId: reset.user_id, action: "auth.password_reset" });
};
