const express = require("express");
const { body, param, query } = require("express-validator");
const adminController = require("../controllers/adminController");
const auth = require("../middlewares/authMiddleware");
const can = require("../middlewares/permissionMiddleware");
const validate = require("../middlewares/validateRequest");
const upload = require("../middlewares/uploadMiddleware");
const { ORG_ROLES, PERMISSIONS: P } = require("@hope/shared/rbac");
const {
    REGIONS, MESSAGE_STATUSES, USER_STATUSES, PAYMENT_STATUSES, PROJECT_STATUSES, APPLICATION_STATUSES,
} = require("@hope/shared/constants");
const { MAX_PAGE_SIZE } = require("../utils/pagination");
const { CONTENT_TYPES } = require("../repositories/contentRepository");

const router = express.Router();

const idParam = param("id").isInt({ min: 1 });
const optionalText = (field, max) => body(field).optional({ values: "null" }).isString().trim().isLength({ max });

const rolesPayload = [
    body("roles").isArray({ min: 1, max: ORG_ROLES.length }).withMessage("Au moins un rôle est requis"),
    body("roles.*").isIn(ORG_ROLES),
];

// Pagination optionnelle : sans "page", la reponse reste un tableau complet.
const paginationQuery = [
    query("page").optional().isInt({ min: 1, max: 100000 }),
    query("pageSize").optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
];

const donationFilters = [
    query("status").optional().isIn(PAYMENT_STATUSES),
    query("from").optional().isISO8601(),
    query("to").optional().isISO8601(),
    query("projectId").optional().isInt({ min: 1 }),
    query("provider").optional().isIn(["stripe", "notchpay", "flutterwave"]),
];

// Champs obligatoires a la creation, par type de contenu.
const REQUIRED_CONTENT_FIELDS = {
    projects: ["title", "description"],
    news: ["title", "content"],
    testimonials: ["author", "content"],
};

const contentValidation = (isCreate) => [
    param("type").isIn(CONTENT_TYPES),
    body().custom((payload, { req }) => {
        if (!isCreate) return true;
        const missing = REQUIRED_CONTENT_FIELDS[req.params.type].filter((field) => !String(payload[field] || "").trim());
        if (missing.length) throw new Error(`Champs obligatoires : ${missing.join(", ")}`);
        return true;
    }),
    body("status").optional().isIn(PROJECT_STATUSES),
    body("region").optional({ values: "falsy" }).isIn(REGIONS),
    body(["budget", "goal_amount"]).optional({ values: "falsy" }).isFloat({ min: 0 }),
    body(["beneficiaries", "trainees", "credits_granted"]).optional({ values: "falsy" }).isInt({ min: 0 }),
    body(["start_date", "end_date"]).optional({ values: "falsy" }).isISO8601(),
    body("project_id").optional({ values: "falsy" }).isInt({ min: 1 }),
    optionalText("title", 255),
    optionalText("summary", 500),
    optionalText("author", 150),
    optionalText("role_label", 150),
    validate,
];

const eventValidation = (isCreate) => [
    (isCreate ? body("title") : body("title").optional()).isString().trim().isLength({ min: 3, max: 255 }),
    (isCreate ? body("description") : body("description").optional()).isString().trim().isLength({ min: 10 }),
    (isCreate ? body("location") : body("location").optional()).isString().trim().isLength({ min: 2, max: 255 }),
    (isCreate ? body("start_at") : body("start_at").optional()).isISO8601(),
    body("end_at").optional({ values: "falsy" }).isISO8601(),
    body("capacity").optional({ values: "falsy" }).isInt({ min: 1, max: 100000 }),
    body("region").optional({ values: "falsy" }).isIn(REGIONS),
    body("project_id").optional({ values: "falsy" }).isInt({ min: 1 }),
    validate,
];

router.use(auth, can(P.ACCESS_ADMIN_DASHBOARD));

// Tableau de bord, roles, journal, systeme, region, rapport
router.get("/stats", can(P.VIEW_STATS), adminController.getStats);
router.get("/roles", adminController.getRoles);
router.get(
    "/logs",
    can(P.VIEW_LOGS),
    [query("limit").optional().isInt({ min: 1, max: 500 }), query("offset").optional().isInt({ min: 0 }), validate],
    adminController.getLogs
);
router.get("/system", can(P.MANAGE_IT), adminController.getSystem);
router.get("/regional", can(P.MANAGE_REGIONAL), [query("region").optional().isIn(REGIONS), validate], adminController.getRegional);
router.get(
    "/reports/annual",
    can(P.VIEW_STATS),
    [query("year").optional().isInt({ min: 2000, max: 2100 }), validate],
    adminController.getAnnualReport
);

// Membres
router.get(
    "/users",
    can(P.VIEW_USERS),
    [
        query("region").optional().isIn(REGIONS),
        query("status").optional().isIn(USER_STATUSES),
        query("role").optional().isIn(ORG_ROLES),
        query("q").optional().isString().trim().isLength({ max: 100 }),
        ...paginationQuery,
        validate,
    ],
    adminController.getUsers
);
router.get("/staff", adminController.getStaff);
router.post(
    "/users",
    can(P.MANAGE_USER_ROLES),
    [
        body("name").isString().trim().isLength({ min: 2, max: 150 }),
        body("email").trim().toLowerCase().isEmail(),
        body("phone").optional({ values: "falsy" }).isString().trim().isLength({ max: 40 }),
        body("region").optional({ values: "falsy" }).isIn(REGIONS),
        ...rolesPayload,
        validate,
    ],
    adminController.createUser
);
router.patch("/users/:id/roles", can(P.MANAGE_USER_ROLES), [idParam, ...rolesPayload, validate], adminController.updateUserRoles);
router.patch(
    "/users/:id/profile",
    can(P.MANAGE_HR),
    [
        idParam,
        optionalText("phone", 40),
        body("region").optional({ values: "falsy" }).isIn(REGIONS),
        optionalText("skills", 2000),
        optionalText("availability", 255),
        body("status").optional().isIn(USER_STATUSES),
        validate,
    ],
    adminController.updateUserProfile
);
router.delete("/users/:id", can(P.DELETE_USERS), [idParam, validate], adminController.deleteUser);

// Messages
router.get(
    "/messages",
    can(P.VIEW_MESSAGES),
    [query("status").optional().isIn(MESSAGE_STATUSES), ...paginationQuery, validate],
    adminController.getMessages
);
router.patch(
    "/messages/:id",
    can(P.VIEW_MESSAGES),
    [
        idParam,
        body("status").optional().isIn(MESSAGE_STATUSES),
        body("assignedTo").optional({ values: "null" }).isInt({ min: 1 }),
        optionalText("notes", 5000),
        validate,
    ],
    adminController.updateMessage
);
router.delete("/messages/:id", can(P.VIEW_MESSAGES), [idParam, validate], adminController.deleteMessage);

// Candidatures
router.get(
    "/applications",
    can(P.MANAGE_APPLICATIONS),
    [query("status").optional().isIn(APPLICATION_STATUSES), ...paginationQuery, validate],
    adminController.getApplications
);
router.post(
    "/applications/:id/review",
    can(P.MANAGE_APPLICATIONS),
    [idParam, optionalText("reviewNote", 2000), validate],
    adminController.reviewApplication
);
router.post(
    "/applications/:id/reject",
    can(P.MANAGE_APPLICATIONS),
    [idParam, optionalText("reviewNote", 2000), validate],
    adminController.rejectApplication
);
router.post(
    "/applications/:id/accept",
    can(P.MANAGE_APPLICATIONS, P.MANAGE_USER_ROLES),
    // Roles obligatoires : ils ne sont jamais deduits de la candidature (poles d'interet indicatifs).
    [
        idParam,
        ...rolesPayload,
        body("linkExisting").optional().isBoolean({ strict: true }),
        optionalText("reviewNote", 2000),
        validate,
    ],
    adminController.acceptApplication
);

// Dons et finance
router.get("/donations", can(P.VIEW_DONATIONS), [...donationFilters, validate], adminController.getDonations);
router.get(
    "/finance/summary",
    can(P.MANAGE_FINANCE),
    [query("year").optional().isInt({ min: 2000, max: 2100 }), validate],
    adminController.getFinanceSummary
);
router.get("/finance/export", can(P.MANAGE_FINANCE), [...donationFilters, validate], adminController.exportDonations);
router.post("/finance/reconcile", can(P.MANAGE_FINANCE), adminController.reconcile);
router.post(
    "/donations/:id/review",
    can(P.MANAGE_FINANCE),
    [idParam, body("decision").isIn(["approve", "reject"]), optionalText("note", 500), validate],
    adminController.resolveDonationReview
);
router.post("/donations/:id/resend-receipt", can(P.MANAGE_FINANCE), [idParam, validate], adminController.resendDonationReceipt);

// Contenus (projets / campagnes, actualites, temoignages)
router.get("/content/:type", can(P.MANAGE_CONTENT), [param("type").isIn(CONTENT_TYPES), validate], adminController.getContent);
router.post("/content/:type", can(P.MANAGE_CONTENT), upload.single("image"), contentValidation(true), adminController.createContent);
router.patch(
    "/content/:type/:id",
    can(P.MANAGE_CONTENT),
    upload.single("image"),
    [idParam, ...contentValidation(false)],
    adminController.updateContent
);
router.delete(
    "/content/:type/:id",
    can(P.MANAGE_CONTENT),
    [param("type").isIn(CONTENT_TYPES), idParam, validate],
    adminController.deleteContent
);

// Evenements et actions terrain
router.get("/events", can(P.MANAGE_ORGANIZATION), adminController.getEvents);
router.post("/events", can(P.MANAGE_ORGANIZATION), upload.single("image"), eventValidation(true), adminController.createEvent);
router.patch(
    "/events/:id",
    can(P.MANAGE_ORGANIZATION),
    upload.single("image"),
    [idParam, ...eventValidation(false)],
    adminController.updateEvent
);
router.delete("/events/:id", can(P.MANAGE_ORGANIZATION), [idParam, validate], adminController.deleteEvent);
router.get("/events/:id/registrations", can(P.MANAGE_ORGANIZATION), [idParam, validate], adminController.getEventRegistrations);

module.exports = router;
