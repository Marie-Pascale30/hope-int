const authService = require("../services/authService");

exports.register = async (req, res) => {
    await authService.register(req.body);
    res.status(201).json({ message: "Compte créé : vous pouvez vous connecter" });
};

exports.login = async (req, res) => {
    const { token, user } = await authService.login(req.body.email, req.body.password);
    res.json({ token, user });
};

exports.me = async (req, res) => {
    res.json(await authService.getMe(req.user.id));
};

exports.updateMe = async (req, res) => {
    res.json(await authService.updateMe(req.user.id, req.body));
};

exports.changePassword = async (req, res) => {
    const result = await authService.changePassword(req.user.id, req.body);
    res.json({ message: "Mot de passe modifié", ...result });
};

exports.forgotPassword = async (req, res) => {
    await authService.requestPasswordReset(req.body.email);
    res.json({ message: "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé." });
};

exports.resetPassword = async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ message: "Mot de passe réinitialisé : vous pouvez vous connecter" });
};
