// Double authentification (TOTP) :
// - obligatoire pour les comptes disposant d'une permission sensible (MFA_REQUIRED_PERMISSIONS,
//   par defaut finance, roles, suppression de comptes, IT), facultative pour les autres ;
// - a la connexion, apres le mot de passe : jeton de verification court (cookie httpOnly) puis code
//   TOTP ou code de secours ; un compte oblige mais non equipe enrole sa double authentification
//   avant d'obtenir une session ;
// - codes de secours haches, a usage unique ; codes TOTP non rejouables (dernier pas memorise).
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mfaRepo = require("../repositories/engagementMfaRepository");
const userRepo = require("../repositories/userRepository");
const attemptRepo = require("../repositories/authAttemptRepository");
const logService = require("./activityLogService");
const totp = require("./engagementTotp");
const { getPermissionsForRoles } = require("@hope/shared/rbac");
const { BACKUP_CODES_COUNT, DEFAULT_MFA_REQUIRED_PERMISSIONS } = require("@hope/shared/engagement");
const { HttpError, badRequest, conflict, forbidden, notFound, unauthorized } = require("../utils/httpError");
const { sha256 } = require("../utils/security");

const CHALLENGE_TTL_SECONDS = 10 * 60;
const MAX_FAILURES = 5;
const ATTEMPT_WINDOW_MINUTES = 15;
const ISSUER = () => process.env.MFA_ISSUER || process.env.ORG_NAME || "HOPE International";

// Permissions imposant la double authentification. Variable vide : jamais obligatoire.
// En test, aucune par defaut (les tests existants se connectent sans second facteur).
function requiredPermissions() {
    const raw = process.env.MFA_REQUIRED_PERMISSIONS;
    if (raw === undefined) return process.env.NODE_ENV === "test" ? [] : DEFAULT_MFA_REQUIRED_PERMISSIONS;
    return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

function isRequiredFor(roles) {
    const required = requiredPermissions();
    if (!required.length) return false;
    const granted = getPermissionsForRoles(Array.isArray(roles) ? roles : [roles]);
    return required.some((permission) => granted.includes(permission));
}

exports.isRequiredFor = isRequiredFor;

const isEnabled = (record) => Boolean(record?.enabled_at);

// Etape demandee apres un mot de passe correct : "verify", "setup" ou null (session directe).
exports.loginRequirement = async (user) => {
    const record = await mfaRepo.find(user.id);
    if (isEnabled(record)) return "verify";
    return isRequiredFor(user.roles || [user.role]) ? "setup" : null;
};

// --- Jeton de verification (entre le mot de passe et le second facteur) ---

exports.signChallenge = (user, step) =>
    jwt.sign({ id: user.id, tv: Number(user.token_version || 0), purpose: "mfa", step }, process.env.JWT_SECRET, {
        expiresIn: CHALLENGE_TTL_SECONDS,
    });

const invalidChallenge = () => unauthorized("Vérification expirée : reconnectez-vous", { code: "MFA_CHALLENGE_INVALID" });

// Utilisateur du jeton de verification (step attendu : "verify" ou "setup").
exports.readChallenge = async (token, step) => {
    let decoded;
    try {
        decoded = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    } catch (_error) {
        throw invalidChallenge();
    }
    if (decoded.purpose !== "mfa" || (step && decoded.step !== step)) throw invalidChallenge();
    const user = await userRepo.findAuthById(decoded.id);
    if (!user || user.status !== "active" || Number(decoded.tv || 0) !== Number(user.token_version || 0)) throw invalidChallenge();
    return user;
};

exports.CHALLENGE_TTL_SECONDS = CHALLENGE_TTL_SECONDS;

// --- Verification d'un code ---

async function assertNotThrottled(userId) {
    if ((await attemptRepo.countRecent("mfa", `user:${userId}`, ATTEMPT_WINDOW_MINUTES)) >= MAX_FAILURES) {
        throw new HttpError(429, "Trop de codes incorrects : réessayez dans 15 minutes.", { code: "MFA_THROTTLED" });
    }
}

async function recordFailure(userId) {
    await attemptRepo.record("mfa", `user:${userId}`);
    await logService.log({ userId, action: "auth.mfa_failed" });
    return badRequest("Code de vérification incorrect", { code: "MFA_CODE_INVALID" });
}

const normalizeBackupCode = (code) => String(code || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Code TOTP (6 chiffres) ou code de secours. Renvoie "totp" ou "backup", sinon leve une erreur.
async function checkCode(userId, code, record) {
    await assertNotThrottled(userId);
    const value = String(code || "").trim();
    if (/^\d{6}$/.test(value.replace(/\s/g, ""))) {
        const step = totp.verify(totp.decryptSecret(record.secret_enc), value);
        if (step !== null && (await mfaRepo.consumeStep(userId, step))) return "totp";
        throw await recordFailure(userId);
    }
    const backup = normalizeBackupCode(value);
    if (backup.length === 10 && isEnabled(record) && (await mfaRepo.consumeBackupCode(userId, sha256(backup)))) return "backup";
    throw await recordFailure(userId);
}

// Seconde etape de la connexion. Renvoie l'utilisateur (l'appelant ouvre la session).
exports.verifyLogin = async (challengeToken, code) => {
    const user = await exports.readChallenge(challengeToken, "verify");
    const record = await mfaRepo.find(user.id);
    if (!isEnabled(record)) throw invalidChallenge();
    const method = await checkCode(user.id, code, record);
    await attemptRepo.clear("mfa", `user:${user.id}`);
    await logService.log({ userId: user.id, action: "auth.mfa_verified", meta: { method } });
    return user;
};

// --- Enrolement ---

function generateBackupCodes() {
    // 10 caracteres parmi 32 (sans 0/o, 1/l ambigus) : 50 bits d'entropie par code.
    const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
    const codes = Array.from({ length: BACKUP_CODES_COUNT }, () =>
        Array.from({ length: 10 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(""));
    return { codes: codes.map((code) => `${code.slice(0, 5)}-${code.slice(5)}`), hashes: codes.map((code) => sha256(code)) };
}

exports.startSetup = async (user) => {
    const record = await mfaRepo.find(user.id);
    if (isEnabled(record)) throw conflict("La double authentification est déjà activée");
    const secret = totp.newSecret();
    await mfaRepo.savePending(user.id, totp.encryptSecret(secret));
    return {
        secret: totp.base32Encode(secret),
        otpauthUrl: totp.otpauthUrl({ secret, account: user.email, issuer: ISSUER() }),
    };
};

// Active la double authentification apres un premier code correct. Les autres sessions sont
// fermees (token_version incremente) : l'appelant ouvre une nouvelle session.
exports.confirmSetup = async (user, code) => {
    const record = await mfaRepo.find(user.id);
    if (!record) throw badRequest("Commencez par générer un secret");
    if (isEnabled(record)) throw conflict("La double authentification est déjà activée");
    await checkCode(user.id, code, record);
    if (!(await mfaRepo.enable(user.id))) throw conflict("La double authentification est déjà activée");
    const { codes, hashes } = generateBackupCodes();
    await mfaRepo.replaceBackupCodes(user.id, hashes);
    await attemptRepo.clear("mfa", `user:${user.id}`);
    await userRepo.bumpTokenVersion(user.id);
    await logService.log({ userId: user.id, action: "auth.mfa_enabled" });
    return { backupCodes: codes };
};

exports.status = async (user) => {
    const record = await mfaRepo.find(user.id);
    return {
        enabled: isEnabled(record),
        required: isRequiredFor(user.roles || [user.role]),
        backupCodesRemaining: isEnabled(record) ? await mfaRepo.countBackupCodes(user.id) : 0,
    };
};

exports.regenerateBackupCodes = async (user, code) => {
    const record = await mfaRepo.find(user.id);
    if (!isEnabled(record)) throw badRequest("La double authentification n'est pas activée");
    await checkCode(user.id, code, record);
    const { codes, hashes } = generateBackupCodes();
    await mfaRepo.replaceBackupCodes(user.id, hashes);
    await logService.log({ userId: user.id, action: "auth.mfa_backup_codes_regenerated" });
    return { backupCodes: codes };
};

// Desactivation par le titulaire : mot de passe et code exiges ; impossible si obligatoire.
exports.disable = async (user, { password, code }) => {
    if (isRequiredFor(user.roles || [user.role])) {
        throw forbidden("La double authentification est obligatoire pour votre rôle");
    }
    const record = await mfaRepo.find(user.id);
    if (!isEnabled(record)) throw badRequest("La double authentification n'est pas activée");
    const hash = await userRepo.findPasswordHashById(user.id);
    if (!hash || !(await bcrypt.compare(String(password || ""), hash))) throw badRequest("Mot de passe actuel incorrect");
    await checkCode(user.id, code, record);
    await mfaRepo.remove(user.id);
    await logService.log({ userId: user.id, action: "auth.mfa_disabled" });
};

// Reinitialisation par un administrateur (telephone perdu) : le compte devra se reequiper a sa
// prochaine connexion si la double authentification lui est obligatoire ; ses sessions sont fermees.
exports.resetByAdmin = async (actor, targetId, { assertCanManage }) => {
    const target = await userRepo.findById(targetId);
    if (!target) throw notFound("Utilisateur introuvable");
    if (Number(target.id) === Number(actor.id)) throw forbidden("Vous ne pouvez pas réinitialiser votre propre double authentification");
    assertCanManage(actor, target);
    await mfaRepo.remove(target.id);
    await userRepo.bumpTokenVersion(target.id);
    await logService.log({ userId: actor.id, action: "admin.mfa_reset", meta: { targetUserId: target.id } });
};

exports.statusForUsers = (ids) => mfaRepo.statusForUsers(ids);
