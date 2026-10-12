// Workflow de validation des contenus : file "a valider" (APPROVE_CONTENT, portee non regionale),
// apercu, approbation (publie par defaut), refus commente, et soumission par les redacteurs.
const express = require("express");
const { body, param, query } = require("express-validator");
const auth = require("../../middlewares/authMiddleware");
const can = require("../../middlewares/permissionMiddleware");
const validate = require("../../middlewares/validateRequest");
const { PERMISSIONS: P } = require("@hope/shared/rbac");
const { CONTENT_REVIEW_STATUSES, REVIEWABLE_CONTENT_TYPES } = require("@hope/shared/volunteering");
const contentReview = require("../../services/contentReviewService");
const contentService = require("../../services/contentService");

const router = express.Router();

const typeParam = param("type").isIn(REVIEWABLE_CONTENT_TYPES);
const idParam = param("id").isInt({ min: 1 }).toInt();

// Relecteur : APPROVE_CONTENT sans restriction regionale.
function approver(req, res, next) {
    if (!contentReview.canApprove(req.user)) {
        return res.status(403).json({ error: "Seule une personne habilitée à valider les contenus peut effectuer cette action" });
    }
    return next();
}

router.use(auth, can(P.ACCESS_ADMIN_DASHBOARD));

router.get(
    "/queue",
    can(P.APPROVE_CONTENT),
    approver,
    [query("status").optional().isIn(CONTENT_REVIEW_STATUSES), validate],
    async (req, res) => res.json(await contentReview.getQueue({ status: req.query.status }))
);

router.get("/count", can(P.APPROVE_CONTENT), approver, async (_req, res) => res.json(await contentReview.countPending()));

router.get("/:type/:id", can(P.APPROVE_CONTENT), approver, [typeParam, idParam, validate], async (req, res) => {
    res.json(await contentReview.getItem(req.params.type, req.params.id));
});

router.post("/:type/:id/submit", can(P.MANAGE_CONTENT), [typeParam, idParam, validate], async (req, res) => {
    res.json(await contentService.submit(req.user, req.params.type, req.params.id));
});

router.post(
    "/:type/:id/approve",
    can(P.APPROVE_CONTENT),
    approver,
    [
        typeParam,
        idParam,
        body("comment").optional({ values: "null" }).isString().trim().isLength({ max: 2000 }),
        body("publish").optional().isBoolean({ strict: true }),
        validate,
    ],
    async (req, res) => {
        res.json(await contentReview.approve(req.user, req.params.type, req.params.id, {
            comment: req.body.comment || null,
            publish: req.body.publish !== false,
        }));
    }
);

router.post(
    "/:type/:id/reject",
    can(P.APPROVE_CONTENT),
    approver,
    [
        typeParam,
        idParam,
        body("comment").isString().trim().isLength({ min: 3, max: 2000 }).withMessage("Expliquez le refus (3 caractères minimum)"),
        validate,
    ],
    async (req, res) => res.json(await contentReview.reject(req.user, req.params.type, req.params.id, { comment: req.body.comment }))
);

module.exports = { basePath: "/api/admin/content-review", router };
