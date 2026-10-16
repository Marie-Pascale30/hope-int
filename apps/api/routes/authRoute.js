const express = require("express");
const { body } = require("express-validator");
const createLimiter = require("../utils/rateLimit");
const authController = require("../controllers/authController");
const mfaService = require("../services/engagementMfaService");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateRequest");

const router = express.Router();

const authLimiter = createLimiter({
    windowMinutes: 15,
    max: 20,
    message: "Trop de tentatives : réessayez dans 15 minutes.",
});

const password = (field) => body(field).isString().isLength({ min: 8, max: 100 }).withMessage("Mot de passe de 8 à 100 caractères");

router.post(
    "/register",
    authLimiter,
    [
        body("name").isString().trim().isLength({ min: 2, max: 150 }),
        body("email").trim().toLowerCase().isEmail(),
        password("password"),
        body("consents").optional().isObject(),
        body("consents.*").optional().isBoolean().withMessage("Choix de consentement invalide"),
        validate,
    ],
    authController.register
);

router.post(
    "/login",
    authLimiter,
    [body("email").trim().toLowerCase().isEmail(), body("password").isString().notEmpty(), validate],
    authController.login
);

router.post(
    "/forgot-password",
    authLimiter,
    [body("email").trim().toLowerCase().isEmail(), validate],
    authController.forgotPassword
);

router.post(
    "/reset-password",
    authLimiter,
    [body("token").isString().isLength({ min: 32, max: 128 }), password("password"), validate],
    authController.resetPassword
);

router.post("/logout", authController.logout);
router.post("/logout-all", auth, authController.logoutAll);

router.get("/me", auth, authController.me);

router.patch(
    "/me",
    auth,
    [
        body("name").optional().isString().trim().isLength({ min: 2, max: 150 }),
        body("phone").optional({ values: "falsy" }).isString().trim().isLength({ max: 40 }),
        validate,
    ],
    authController.updateMe
);

router.post(
    "/change-password",
    auth,
    authLimiter,
    [body("currentPassword").isString().notEmpty(), password("newPassword"), validate],
    authController.changePassword
);

// --- Double authentification (TOTP) ---
const mfaLimiter = createLimiter({
    windowMinutes: 15,
    max: 30,
    message: "Trop de tentatives : réessayez dans 15 minutes.",
});
router.use("/mfa", mfaService.requireActive);
const mfaCode = body("code").isString().trim().isLength({ min: 6, max: 20 }).withMessage("Code de vérification requis");

// Seconde etape de la connexion (cookie de verification pose par /login).
router.post("/mfa/verify", mfaLimiter, [mfaCode, validate], authController.mfaVerify);
// Enrolement : session ouverte, ou jeton de verification d'un compte oblige de s'equiper.
router.post("/mfa/setup", mfaLimiter, auth.optionalAuth, authController.mfaSetup);
router.post("/mfa/enable", mfaLimiter, auth.optionalAuth, [mfaCode, validate], authController.mfaEnable);
router.get("/mfa/status", auth, authController.mfaStatus);
router.post("/mfa/disable", auth, mfaLimiter, [body("password").isString().notEmpty(), mfaCode, validate], authController.mfaDisable);
router.post("/mfa/backup-codes", auth, mfaLimiter, [mfaCode, validate], authController.mfaBackupCodes);

module.exports = router;
