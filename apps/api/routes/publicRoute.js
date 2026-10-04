const express = require("express");
const { body, param, query } = require("express-validator");
const createLimiter = require("../utils/rateLimit");
const publicController = require("../controllers/publicController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateRequest");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { INTEREST_VALUES } = require("@hope/shared/applications");
const { REGIONS } = require("@hope/shared/constants");
const { CONTENT_TYPES } = require("../repositories/contentRepository");

const router = express.Router();

// Formulaires publics : limite anti-spam par adresse IP.
const formLimiter = createLimiter({
    windowMinutes: 60,
    max: 10,
    message: "Trop d'envois depuis votre connexion : réessayez dans une heure.",
});

const idParam = param("id").isInt({ min: 1 });

router.get("/meta", publicController.getMeta);
router.get("/impact", publicController.getImpact);

router.get(
    "/content/:type",
    [param("type").isIn(CONTENT_TYPES), query("region").optional().isIn(REGIONS), validate],
    publicController.listContent
);
router.get("/content/:type/:id", [param("type").isIn(CONTENT_TYPES), idParam, validate], publicController.getContent);

router.post(
    "/messages",
    formLimiter,
    [
        body("name").isString().trim().isLength({ min: 2, max: 150 }),
        body("email").trim().toLowerCase().isEmail(),
        body("subject").isString().trim().isLength({ min: 3, max: 255 }),
        body("content").isString().trim().isLength({ min: 10, max: 5000 }),
        validate,
    ],
    publicController.createMessage
);

router.post(
    "/applications",
    formLimiter,
    [
        body("name").isString().trim().isLength({ min: 2, max: 150 }),
        body("email").trim().toLowerCase().isEmail(),
        body("phone").optional({ values: "falsy" }).isString().trim().isLength({ max: 40 }),
        body("region").optional({ values: "falsy" }).isIn(REGIONS),
        body("motivation").isString().trim().isLength({ min: 30, max: 5000 }),
        // Poles d'interet indicatifs (referentiel INTEREST_AREAS) ; l'ancien champ desiredRoles est ignore.
        body("interests").optional().isArray({ max: INTEREST_VALUES.length }),
        body("interests.*").isIn(INTEREST_VALUES),
        validate,
    ],
    publicController.createApplication
);

router.get("/events", optionalAuth, [query("region").optional().isIn(REGIONS), validate], publicController.listEvents);
router.get("/events/mine", auth, publicController.myEvents);
router.get("/events/:id", optionalAuth, [idParam, validate], publicController.getEvent);
router.post("/events/:id/registration", auth, [idParam, validate], publicController.registerEvent);
router.delete("/events/:id/registration", auth, [idParam, validate], publicController.unregisterEvent);

module.exports = router;
