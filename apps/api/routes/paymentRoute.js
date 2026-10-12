const express = require("express");
const { body, param } = require("express-validator");
const createLimiter = require("../utils/rateLimit");
const paymentController = require("../controllers/paymentController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateRequest");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { TRIBUTE_TYPES, TRIBUTE_LIMITS } = require("@hope/shared/fundraising");

const router = express.Router();

const donationLimiter = createLimiter({
    windowMinutes: 15,
    max: 30,
    message: "Trop de tentatives de paiement : réessayez dans quelques minutes.",
});

const tokenParam = param("token").isHexadecimal().isLength({ min: 48, max: 48 });

router.post(
    "/donations",
    donationLimiter,
    optionalAuth,
    [
        body("amount").isFloat({ gt: 0 }),
        body("provider").isIn(["stripe", "mobile_money", "notchpay", "flutterwave"]),
        body("frequency").optional().isIn(["once", "monthly"]),
        body("projectId").optional({ values: "falsy" }).isInt({ min: 1 }),
        body("donorName").optional({ values: "falsy" }).isString().trim().isLength({ min: 2, max: 150 }),
        body("donorEmail").optional({ values: "falsy" }).isEmail(),
        body("phone").optional({ values: "falsy" }).isString().trim().isLength({ max: 40 }),
        // Source (?ref=) : nettoyee et tronquee a 60 caracteres par le service.
        body("source").optional({ values: "falsy" }).isString().isLength({ max: 200 }),
        // Don en hommage (facultatif) : longueurs bornees, texte brut.
        body("tributeType").optional({ values: "falsy" }).isIn(TRIBUTE_TYPES),
        body("tributeName").optional({ values: "falsy" }).isString().isLength({ max: TRIBUTE_LIMITS.name }),
        body("tributeEmail").optional({ values: "falsy" }).isEmail().isLength({ max: TRIBUTE_LIMITS.email }),
        body("tributeMessage").optional({ values: "falsy" }).isString().isLength({ max: TRIBUTE_LIMITS.message }),
        // Collecte personnelle (slug) et engagement Mobile Money (reference du lien de rappel).
        body("fundraiser").optional({ values: "falsy" }).matches(/^[a-z0-9-]{3,80}$/),
        body("pledgeRef").optional({ values: "falsy" }).isHexadecimal().isLength({ min: 24, max: 24 }),
        body("anonymous").optional().isBoolean({ strict: true }),
        validate,
    ],
    paymentController.createDonation
);

// Acces par jeton de recu (48 caracteres aleatoires) : la page de remerciement fonctionne sans compte.
router.get("/receipts/:token", [tokenParam, validate], paymentController.getReceipt);
router.post(
    "/receipts/:token/confirm",
    donationLimiter,
    [tokenParam, body("transactionId").optional().isString().isLength({ max: 64 }), body("status").optional().isString(), validate],
    paymentController.confirmReceipt
);
router.get("/receipts/:token/pdf", [tokenParam, validate], paymentController.downloadReceipt);
// Arret d'un don mensuel depuis le lien du recu (sans compte) ; CSRF : protection globale.
router.post(
    "/receipts/:token/cancel-subscription",
    donationLimiter,
    [tokenParam, validate],
    paymentController.cancelSubscriptionByReceipt
);

// Recapitulatif annuel des dons confirmes du compte connecte.
router.get(
    "/receipts/annual/:year/pdf",
    auth,
    [param("year").isInt({ min: 2000, max: 2100 }), validate],
    paymentController.downloadAnnualReceipt
);

router.get("/mine", auth, paymentController.getMine);
router.delete(
    "/subscriptions/:id",
    auth,
    [param("id").matches(/^sub_[A-Za-z0-9]+$/), validate],
    paymentController.cancelSubscription
);

router.post("/flutterwave/webhook", paymentController.handleFlutterwaveWebhook);

module.exports = router;
