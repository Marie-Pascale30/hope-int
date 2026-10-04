const authService = require("../services/authService");
const { resolveLocale } = require("../i18n");
const { setSessionCookie, clearSessionCookie } = require("../config/session");

exports.register = async (req, res) => {
    await authService.register(req.body);
    res.status(201).json({ message: "Compte créé : vous pouvez vous connecter" });
};

exports.login = async (req, res) => {
    const { token, user } = await authService.login(req.body.email, req.body.password);
    setSessionCookie(res, token);
    res.json({ user });
};

exports.logout = async (_req, res) => {
    clearSessionCookie(res);
    res.json({ message: "Déconnecté" });
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
