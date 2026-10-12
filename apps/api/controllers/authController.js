const authService = require("../services/authService");
const mfaService = require("../services/engagementMfaService");
const { resolveLocale } = require("../i18n");
const { setSessionCookie, clearSessionCookie } = require("../config/session");

// Jeton de verification de la double authentification : cookie httpOnly court, limite aux routes
// /api/auth/mfa (jamais une session : il ne donne acces qu'a la saisie du second facteur).
const MFA_COOKIE = "hope_mfa";

function mfaCookieOptions() {
    const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production" || sameSite === "none";
    return {
        httpOnly: true,
        secure,
        sameSite,
        path: "/api/auth/mfa",
        ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    };
}

const setMfaCookie = (res, token) => res.cookie(MFA_COOKIE, token, { ...mfaCookieOptions(), maxAge: mfaService.CHALLENGE_TTL_SECONDS * 1000 });
const clearMfaCookie = (res) => res.clearCookie(MFA_COOKIE, mfaCookieOptions());

exports.MFA_COOKIE = MFA_COOKIE;

// Reponse identique que l'email soit deja inscrit ou non (voir authService.register).
exports.register = async (req, res) => {
    await authService.register(req.body, resolveLocale(req));
    res.status(201).json({ message: "Inscription enregistrée : vous pouvez vous connecter. Si un compte existait déjà avec cet email, son titulaire vient d'être prévenu." });
};

// Avec double authentification : { mfaRequired: "verify" | "setup" } et aucun cookie de session.
exports.login = async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password);
    if (result.mfa) {
        setMfaCookie(res, result.challenge);
        return res.json({ mfaRequired: result.mfa });
    }
    setSessionCookie(res, result.token);
    res.json({ user: result.user });
};

exports.logout = async (_req, res) => {
    clearSessionCookie(res);
    clearMfaCookie(res);
    res.json({ message: "Déconnecté" });
};

// Ferme toutes les sessions du compte, y compris celle-ci.
exports.logoutAll = async (req, res) => {
    await authService.logoutAll(req.user.id);
    clearSessionCookie(res);
    res.json({ message: "Déconnecté de toutes les sessions" });
};

exports.me = async (req, res) => {
    res.json(await authService.getMe(req.user.id));
};

exports.updateMe = async (req, res) => {
    res.json(await authService.updateMe(req.user.id, req.body));
};

exports.changePassword = async (req, res) => {
    // Les anciens jetons sont invalides : la session continue avec un nouveau cookie.
    const { token, user } = await authService.changePassword(req.user.id, req.body);
    setSessionCookie(res, token);
    res.json({ message: "Mot de passe modifié", user });
};

exports.forgotPassword = async (req, res) => {
    await authService.requestPasswordReset(req.body.email, resolveLocale(req));
    res.json({ message: "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé." });
};

exports.resetPassword = async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ message: "Mot de passe réinitialisé : vous pouvez vous connecter" });
};

// --- Double authentification ---

// Seconde etape de la connexion : code TOTP ou code de secours.
exports.mfaVerify = async (req, res) => {
    const user = await mfaService.verifyLogin(req.cookies?.[MFA_COOKIE], req.body.code);
    const session = await authService.openSession(user);
    clearMfaCookie(res);
    setSessionCookie(res, session.token);
    res.json({ user: session.user });
};

// Compte concerne par l'enrolement : session ouverte, sinon jeton de verification "setup"
// (compte de l'equipe oblige de s'equiper avant d'obtenir une session).
async function enrollingUser(req) {
    if (req.user) return { user: req.user, viaChallenge: false };
    return { user: await mfaService.readChallenge(req.cookies?.[MFA_COOKIE], "setup"), viaChallenge: true };
}

exports.mfaSetup = async (req, res) => {
    const { user } = await enrollingUser(req);
    res.json(await mfaService.startSetup(user));
};

// Activation : les autres sessions sont fermees, une nouvelle session est ouverte ici.
exports.mfaEnable = async (req, res) => {
    const { user, viaChallenge } = await enrollingUser(req);
    const { backupCodes } = await mfaService.confirmSetup(user, req.body.code);
    const session = await authService.openSession(user);
    if (viaChallenge) clearMfaCookie(res);
    setSessionCookie(res, session.token);
    res.json({ message: "Double authentification activée", backupCodes, user: session.user });
};

exports.mfaStatus = async (req, res) => {
    res.json(await mfaService.status(req.user));
};

exports.mfaDisable = async (req, res) => {
    await mfaService.disable(req.user, req.body);
    res.json({ message: "Double authentification désactivée" });
};

exports.mfaBackupCodes = async (req, res) => {
    res.json(await mfaService.regenerateBackupCodes(req.user, req.body.code));
};
