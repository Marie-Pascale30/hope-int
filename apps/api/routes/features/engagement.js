// Module engagement : preferences de communication (liens signes, espace membre), newsletter
// (double opt-in), droits RGPD en libre-service (export, effacement), projets soutenus.
const express = require("express");
const { body, query } = require("express-validator");
const createLimiter = require("../../utils/rateLimit");
const auth = require("../../middlewares/authMiddleware");
const validate = require("../../middlewares/validateRequest");
const consentService = require("../../services/consentService");
const privacyService = require("../../services/privacyService");
const campaignService = require("../../services/campaignService");
const { resolveLocale } = require("../../i18n");
const { clearSessionCookie } = require("../../config/session");
const { CONSENT_TOPICS } = require("@hope/shared/engagement");

const router = express.Router();

const publicLimiter = createLimiter({ windowMinutes: 15, max: 30, message: "Trop de requêtes : réessayez dans 15 minutes." });
const sensitiveLimiter = createLimiter({ windowMinutes: 15, max: 10, message: "Trop de tentatives : réessayez dans 15 minutes." });

const token = (location) => location("token").isString().isLength({ min: 20, max: 2500 }).withMessage("Lien invalide");
const topicsBody = [
    body("topics").isObject().withMessage("Préférences invalides"),
    ...CONSENT_TOPICS.map((topic) => body(`topics.${topic}`).optional().isBoolean().withMessage("Préférences invalides")),
];

// --- Liens signes (sans connexion) ---

router.get("/preferences", publicLimiter, [token(query), validate], async (req, res) => {
    res.json(await consentService.getByToken(req.query.token));
});

router.put("/preferences", publicLimiter, [token(body), ...topicsBody, validate], async (req, res) => {
    res.json(await consentService.updateByToken(req.body.token, req.body.topics));
});

router.post(
    "/unsubscribe",
    publicLimiter,
    [token(body), body("topic").isIn([...CONSENT_TOPICS, "all"]).withMessage("Sujet de communication inconnu"), validate],
    async (req, res) => {
        res.json(await consentService.unsubscribeByToken(req.body.token, req.body.topic));
    }
);

// --- Newsletter (double opt-in) : reponse identique que l'adresse soit deja inscrite ou non ---

router.post(
    "/newsletter/subscribe",
    publicLimiter,
    [body("email").trim().toLowerCase().isEmail().isLength({ max: 180 }).withMessage("Adresse email invalide"), validate],
    async (req, res) => {
        await consentService.requestNewsletter(req.body.email, resolveLocale(req));
        res.status(202).json({ message: "Vérifiez votre boîte de réception pour confirmer votre inscription." });
    }
);

router.post("/newsletter/confirm", publicLimiter, [token(body), validate], async (req, res) => {
    res.json(await consentService.confirmNewsletter(req.body.token));
});

// --- Espace membre ---

router.get("/me/preferences", auth, async (req, res) => {
    res.json(await consentService.getForUser(req.user));
});

router.put("/me/preferences", auth, [...topicsBody, validate], async (req, res) => {
    res.json(await consentService.updateForUser(req.user, req.body.topics));
});

router.get("/me/supported-projects", auth, async (req, res) => {
    res.json(await campaignService.supportedProjects(req.user));
});

// --- Droits RGPD ---

router.get("/privacy/export", auth, sensitiveLimiter, async (req, res) => {
    const data = await privacyService.exportFor(req.user);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="mes-donnees-hope-${date}.json"`);
    res.json(data);
});

router.post(
    "/privacy/erasure",
    auth,
    sensitiveLimiter,
    [body("password").isString().notEmpty(), body("confirmation").isBoolean().withMessage("Confirmez la suppression définitive de vos données"), validate],
    async (req, res) => {
        const result = await privacyService.eraseAccount(req.user, { password: req.body.password, confirmation: req.body.confirmation });
        clearSessionCookie(res);
        res.json({ message: "Vos données personnelles ont été effacées", ...result });
    }
);

module.exports = { basePath: "/api/engagement", router };
