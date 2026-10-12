// Collecte de fonds : back-office (indicateurs Finance, dons hors ligne, engagements Mobile Money,
// recapitulatifs fiscaux annuels, moderation des collectes personnelles).
const express = require("express");
const { body, param, query } = require("express-validator");
const auth = require("../../middlewares/authMiddleware");
const can = require("../../middlewares/permissionMiddleware");
const validate = require("../../middlewares/validateRequest");
const { proofUpload } = require("../../services/donationProofs");
const insightsService = require("../../services/fundraisingInsightsService");
const offlineService = require("../../services/donationOfflineService");
const pledgeService = require("../../services/donationPledgeService");
const annualService = require("../../services/donationAnnualService");
const pageService = require("../../services/fundraisingPageService");
const { PERMISSIONS: P } = require("@hope/shared/rbac");
const { OFFLINE_KINDS, OFFLINE_STATUSES, PLEDGE_STATUSES, FUNDRAISER_STATUSES } = require("@hope/shared/fundraising");

const router = express.Router();
router.use(auth);

const idParam = param("id").isInt({ min: 1 }).toInt();
const yearValue = (location) => location("year").isInt({ min: 2000, max: 2100 }).toInt();

// --- Indicateurs (Finance) ---

router.get(
    "/insights",
    can(P.MANAGE_FINANCE),
    [query("year").optional().isInt({ min: 2000, max: 2100 }), validate],
    async (req, res) => res.json(await insightsService.getInsights(req.user, { year: req.query.year }))
);

// --- Dons hors ligne ---

router.get(
    "/offline",
    can(P.MANAGE_FINANCE),
    [query("status").optional().isIn(OFFLINE_STATUSES), validate],
    async (req, res) => res.json(await offlineService.list(req.user, { status: req.query.status }))
);

router.post(
    "/offline",
    can(P.MANAGE_FINANCE),
    proofUpload("proof"),
    [
        body("kind").isIn(OFFLINE_KINDS),
        body("amount").isFloat({ gt: 0 }),
        body("currency").isIn(["eur", "xaf"]),
        body("donorName").isString().trim().isLength({ min: 2, max: 150 }),
        body("donorEmail").optional({ values: "falsy" }).isEmail().isLength({ max: 180 }),
        body("projectId").optional({ values: "falsy" }).isInt({ min: 1 }),
        body("receivedOn").isISO8601(),
        body("reference").optional({ values: "falsy" }).isString().isLength({ max: 100 }),
        body("inKindDescription").optional({ values: "falsy" }).isString().isLength({ max: 200 }),
        body("note").optional({ values: "falsy" }).isString().isLength({ max: 500 }),
        validate,
    ],
    async (req, res) => res.status(201).json(await offlineService.create(req.user, req.body, req.proof))
);

router.get("/offline/:id/proof", can(P.MANAGE_FINANCE), [idParam, validate], async (req, res) => {
    const proof = await offlineService.getProof(req.user, req.params.id);
    res.setHeader("Content-Type", proof.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${proof.name}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(proof.buffer);
});

router.post("/offline/:id/validate", can(P.MANAGE_FINANCE), [idParam, validate], async (req, res) => {
    res.json(await offlineService.validate(req.user, req.params.id));
});

router.post(
    "/offline/:id/reject",
    can(P.MANAGE_FINANCE),
    [idParam, body("reason").optional({ values: "falsy" }).isString().isLength({ max: 500 }), validate],
    async (req, res) => res.json(await offlineService.reject(req.user, req.params.id, req.body.reason))
);

// --- Engagements Mobile Money ---

router.get(
    "/pledges",
    can(P.VIEW_DONATIONS),
    [query("status").optional().isIn(PLEDGE_STATUSES), validate],
    async (req, res) => res.json(await pledgeService.list(req.user, { status: req.query.status }))
);

// --- Recapitulatifs fiscaux annuels ---

router.get("/annual-summaries/:year", can(P.MANAGE_FINANCE), [yearValue(param), validate], async (req, res) => {
    res.json(await annualService.status(req.params.year));
});

router.post("/annual-summaries", can(P.MANAGE_FINANCE), [yearValue(body), validate], async (req, res) => {
    res.json(await annualService.trigger(req.user, req.body.year));
});

// --- Moderation des collectes personnelles ---

router.get(
    "/fundraisers",
    can(P.MANAGE_CONTENT),
    [query("status").optional().isIn(FUNDRAISER_STATUSES), validate],
    async (req, res) => res.json(await pageService.list({ status: req.query.status }))
);

router.post(
    "/fundraisers/:id/moderate",
    can(P.MANAGE_CONTENT),
    [
        idParam,
        body("decision").isIn(["approve", "reject"]),
        body("note").optional({ values: "falsy" }).isString().isLength({ max: 500 }),
        validate,
    ],
    async (req, res) => res.json(await pageService.moderate(req.user, req.params.id, req.body))
);

module.exports = { basePath: "/api/fundraising/admin", router };
