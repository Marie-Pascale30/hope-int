// Collecte de fonds : routes publiques et espace membre (collectes personnelles, engagements de
// don mensuel Mobile Money, portail de facturation Stripe des dons mensuels).
const express = require("express");
const { body, param, query } = require("express-validator");
const auth = require("../../middlewares/authMiddleware");
const { optionalAuth } = require("../../middlewares/authMiddleware");
const validate = require("../../middlewares/validateRequest");
const upload = require("../../middlewares/uploadMiddleware");
const createLimiter = require("../../utils/rateLimit");
const pageService = require("../../services/fundraisingPageService");
const pledgeService = require("../../services/donationPledgeService");
const dunningService = require("../../services/donationDunningService");
const { FUNDRAISER_LIMITS, PLEDGE_DAY_RANGE, PLEDGE_STATUSES } = require("@hope/shared/fundraising");

const router = express.Router();

const writeLimiter = createLimiter({
    windowMinutes: 15,
    max: 20,
    message: "Trop de tentatives : réessayez dans 15 minutes.",
});

const idParam = param("id").isInt({ min: 1 }).toInt();
const tokenParam = param("token").isHexadecimal().isLength({ min: 48, max: 48 });
const slugParam = param("slug").matches(/^[a-z0-9-]{3,80}$/);

// --- Collectes personnelles ---

router.get(
    "/fundraisers",
    [query("projectId").optional().isInt({ min: 1 }).toInt(), validate],
    async (req, res) => res.json(await pageService.listPublic({ projectId: req.query.projectId }))
);

router.get("/fundraisers/public/:slug", [slugParam, validate], async (req, res) => {
    res.json(await pageService.getPublic(req.params.slug));
});

router.get("/fundraisers/mine", auth, async (req, res) => res.json(await pageService.getMine(req.user)));

const fundraiserFields = (isCreate) => {
    const opt = (field) => (isCreate ? body(field) : body(field).optional());
    return [
        opt("title").isString().isLength({ min: 5, max: FUNDRAISER_LIMITS.title }),
        opt("story").isString().isLength({ min: FUNDRAISER_LIMITS.storyMin, max: FUNDRAISER_LIMITS.story }),
        opt("goalAmount").isFloat({ gt: 0 }),
        opt("currency").isIn(["eur", "xaf"]),
        opt("projectId").isInt({ min: 1 }),
        body("endsOn").optional({ values: "falsy" }).isISO8601(),
        body("status").optional().isIn(["closed"]),
    ];
};

router.post(
    "/fundraisers",
    writeLimiter,
    auth,
    upload.single("image"),
    [...fundraiserFields(true), validate],
    async (req, res) => res.status(201).json(await pageService.create(req.user, req.body, req.file))
);

router.patch(
    "/fundraisers/:id",
    auth,
    upload.single("image"),
    [idParam, ...fundraiserFields(false), validate],
    async (req, res) => res.json(await pageService.updateMine(req.user, req.params.id, req.body, req.file))
);

// --- Engagements de don mensuel Mobile Money ---

const pledgeFields = (isCreate) => {
    const opt = (field) => (isCreate ? body(field) : body(field).optional());
    return [
        opt("amount").isFloat({ gt: 0 }),
        opt("dayOfMonth").isInt({ min: PLEDGE_DAY_RANGE.min, max: PLEDGE_DAY_RANGE.max }).toInt(),
        body("projectId").optional({ values: "null" }).custom((value) => value === "" || Number.isInteger(Number(value))),
        body("status").optional().isIn(PLEDGE_STATUSES),
    ];
};

router.post(
    "/pledges",
    writeLimiter,
    optionalAuth,
    [
        ...pledgeFields(true),
        body("donorName").optional({ values: "falsy" }).isString().trim().isLength({ min: 2, max: 150 }),
        body("donorEmail").optional({ values: "falsy" }).isEmail().isLength({ max: 180 }),
        validate,
    ],
    async (req, res) => res.status(201).json(await pledgeService.create(req.user, req.body))
);

router.get("/pledges/mine", auth, async (req, res) => res.json(await pledgeService.getMine(req.user)));

router.patch(
    "/pledges/:id",
    auth,
    [idParam, ...pledgeFields(false), validate],
    async (req, res) => res.json(await pledgeService.updateMine(req.user, req.params.id, req.body))
);

// Gestion sans compte : jeton secret (48 caracteres) recu par email.
router.get("/pledges/token/:token", [tokenParam, validate], async (req, res) => {
    res.json(await pledgeService.getByToken(req.params.token));
});

router.patch(
    "/pledges/token/:token",
    writeLimiter,
    [tokenParam, ...pledgeFields(false), validate],
    async (req, res) => res.json(await pledgeService.updateByToken(req.params.token, req.body))
);

// --- Dons mensuels Stripe : portail de facturation (mise a jour de la carte) ---

router.post(
    "/subscriptions/portal",
    writeLimiter,
    optionalAuth,
    [
        body("token").optional().isHexadecimal().isLength({ min: 48, max: 48 }),
        body("subscriptionId").optional().matches(/^sub_[A-Za-z0-9]+$/),
        validate,
    ],
    async (req, res) => {
        if (req.body.token) return res.json(await dunningService.portalByReceiptToken(req.body.token));
        if (req.body.subscriptionId && req.user) return res.json(await dunningService.portalForUser(req.user, req.body.subscriptionId));
        return res.status(401).json({ error: "Authentification requise" });
    }
);

module.exports = { basePath: "/api/fundraising", router };
