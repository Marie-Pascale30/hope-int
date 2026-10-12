// Administration de la transparence : budget previsionnel et depenses par projet (finance),
// export "bailleurs", publication des annees et documents publics (direction), portraits
// publics de l'equipe (RH). Monte avant transparency.js (ordre alphabetique des fichiers).
const express = require("express");
const { body, param, query } = require("express-validator");
const requireAuth = require("../../middlewares/authMiddleware");
const can = require("../../middlewares/permissionMiddleware");
const validate = require("../../middlewares/validateRequest");
const upload = require("../../middlewares/uploadMiddleware");
const budgetService = require("../../services/budgetService");
const transparencyService = require("../../services/transparencyService");
const { uploadReceipt, uploadPublicDocument } = require("../../services/transparencyFiles");
const { PERMISSIONS: P } = require("@hope/shared/rbac");
const { CURRENCIES } = require("@hope/shared/constants");
const { EXPENSE_CATEGORIES, PUBLIC_DOCUMENT_KINDS, BUDGET_AMOUNT_MAX } = require("@hope/shared/transparency");

const router = express.Router();
router.use(requireAuth);

const idParam = param("id").isInt({ min: 1 }).toInt();
const isoDate = (field) => query(field).optional({ values: "falsy" }).isISO8601({ strict: true }).isLength({ min: 10, max: 10 });
const flag = (value) => value === true || value === "1" || value === "true" || value === "on";

// Montant arrondi a l'unite en francs CFA (pas de centimes), au centime en euros.
const normalizeAmount = (amount, currency) => (currency === "xaf" ? Math.round(amount) : Math.round(amount * 100) / 100);

// Toute modification des chiffres invalide le cache des pages publiques.
const refreshPublic = () => transparencyService.clearCache();

// ---------- Budget previsionnel ----------

const lineValidation = [
    body("category").isIn(EXPENSE_CATEGORIES),
    body("label").optional({ values: "null" }).isString().trim().isLength({ max: 255 }),
    body("amount").isFloat({ gt: 0, max: BUDGET_AMOUNT_MAX }).toFloat(),
    body("currency").isIn(CURRENCIES),
    validate,
];

const linePayload = (req) => ({
    category: req.body.category,
    label: req.body.label || null,
    amount: normalizeAmount(req.body.amount, req.body.currency),
    currency: req.body.currency,
});

router.get("/budget/projects", can(P.MANAGE_FINANCE), async (req, res) => {
    res.json(await budgetService.listProjects(req.user));
});

router.get("/budget/projects/:id", can(P.MANAGE_FINANCE), [idParam, validate], async (req, res) => {
    res.json(await budgetService.getProjectBudget(req.user, req.params.id));
});

router.post("/budget/projects/:id/lines", can(P.MANAGE_FINANCE), [idParam, ...lineValidation], async (req, res) => {
    const result = await budgetService.createLine(req.user, req.params.id, linePayload(req));
    refreshPublic();
    res.status(201).json(result);
});

router.patch("/budget/lines/:id", can(P.MANAGE_FINANCE), [idParam, ...lineValidation], async (req, res) => {
    await budgetService.updateLine(req.user, req.params.id, linePayload(req));
    refreshPublic();
    res.json({ message: "Ligne de budget mise à jour" });
});

router.delete("/budget/lines/:id", can(P.MANAGE_FINANCE), [idParam, validate], async (req, res) => {
    await budgetService.removeLine(req.user, req.params.id);
    refreshPublic();
    res.json({ message: "Ligne de budget supprimée" });
});

// Export "bailleurs" (CSV) d'un projet sur une periode (dates incluses), journalise.
router.get(
    "/budget/projects/:id/export",
    can(P.MANAGE_FINANCE),
    [idParam, isoDate("from"), isoDate("to"), validate],
    async (req, res) => {
        const { csv } = await budgetService.exportDonorReport(req.user, req.params.id, { from: req.query.from, to: req.query.to });
        const period = [req.query.from, req.query.to].filter(Boolean).join("_") || "complet";
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="rapport-bailleurs-projet-${req.params.id}-${period}.csv"`);
        res.setHeader("Cache-Control", "no-store");
        res.send(csv);
    }
);

// ---------- Depenses ----------

// Lendemain (UTC) : marge pour les fuseaux, une depense ne peut pas etre datee plus loin.
function latestSpentOn() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

const expenseValidation = [
    body("projectId").optional({ values: "falsy" }).isInt({ min: 1 }).toInt(),
    body("category").isIn(EXPENSE_CATEGORIES),
    body("amount").isFloat({ gt: 0, max: BUDGET_AMOUNT_MAX }).toFloat(),
    body("currency").isIn(CURRENCIES),
    // Date de la depense : pas dans le futur.
    body("spentOn")
        .isISO8601({ strict: true })
        .isLength({ min: 10, max: 10 })
        .custom((value) => {
            if (value > latestSpentOn()) throw new Error("Date de dépense dans le futur");
            return true;
        }),
    body("description").isString().trim().isLength({ min: 3, max: 500 }),
    validate,
];

const expensePayload = (req) => ({
    projectId: req.body.projectId || null,
    category: req.body.category,
    amount: normalizeAmount(req.body.amount, req.body.currency),
    currency: req.body.currency,
    spentOn: req.body.spentOn,
    description: req.body.description,
});

router.get(
    "/expenses",
    can(P.MANAGE_FINANCE),
    [
        query("projectId").optional({ values: "falsy" }).isInt({ min: 1 }).toInt(),
        query("general").optional().isIn(["0", "1"]),
        query("category").optional({ values: "falsy" }).isIn(EXPENSE_CATEGORIES),
        isoDate("from"),
        isoDate("to"),
        validate,
    ],
    async (req, res) => {
        res.json(await budgetService.listExpenses(req.user, {
            projectId: req.query.projectId || undefined,
            general: req.query.general === "1",
            category: req.query.category || undefined,
            from: req.query.from || undefined,
            to: req.query.to || undefined,
        }));
    }
);

router.post("/expenses", can(P.MANAGE_FINANCE), uploadReceipt("receipt"), expenseValidation, async (req, res) => {
    const expense = await budgetService.createExpense(req.user, expensePayload(req), req.storedFile);
    refreshPublic();
    res.status(201).json(expense);
});

router.patch("/expenses/:id", can(P.MANAGE_FINANCE), uploadReceipt("receipt"), [idParam, ...expenseValidation], async (req, res) => {
    const expense = await budgetService.updateExpense(req.user, req.params.id, expensePayload(req), req.storedFile, {
        removeReceipt: flag(req.body.removeReceipt),
    });
    refreshPublic();
    res.json(expense);
});

router.delete("/expenses/:id", can(P.MANAGE_FINANCE), [idParam, validate], async (req, res) => {
    await budgetService.removeExpense(req.user, req.params.id);
    refreshPublic();
    res.json({ message: "Dépense supprimée" });
});

// Justificatif : jamais servi publiquement ; telechargement journalise.
router.get("/expenses/:id/receipt", can(P.MANAGE_FINANCE), [idParam, validate], async (req, res) => {
    const receipt = await budgetService.getReceipt(req.user, req.params.id);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", receipt.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${receipt.name.replace(/"/g, "")}"`);
    res.sendFile(receipt.path);
});

// ---------- Publication annuelle et documents publics ----------

router.get("/years", can(P.MANAGE_FINANCE), async (_req, res) => {
    res.json(await transparencyService.listYearsAdmin());
});

router.put(
    "/years/:year",
    can(P.MANAGE_FINANCE),
    [
        param("year").isInt({ min: 2000, max: 2100 }).toInt(),
        body("published").isBoolean().toBoolean(),
        body("note").optional({ values: "null" }).isString().trim().isLength({ max: 2000 }),
        validate,
    ],
    async (req, res) => {
        res.json(await transparencyService.setYearPublication(req.user, req.params.year, {
            published: req.body.published,
            note: req.body.note || null,
        }));
    }
);

router.get("/documents", can(P.MANAGE_FINANCE), async (_req, res) => {
    res.json(await transparencyService.listDocumentsAdmin());
});

router.post(
    "/documents",
    can(P.MANAGE_FINANCE),
    uploadPublicDocument("file"),
    [
        body("title").isString().trim().isLength({ min: 3, max: 255 }),
        body("year").isInt({ min: 2000, max: 2100 }).toInt(),
        body("kind").optional({ values: "falsy" }).isIn(PUBLIC_DOCUMENT_KINDS),
        validate,
    ],
    async (req, res) => {
        const document = await transparencyService.createDocument(
            req.user,
            { title: req.body.title, year: req.body.year, kind: req.body.kind || "annual_report" },
            req.storedFile
        );
        res.status(201).json(document);
    }
);

router.delete("/documents/:id", can(P.MANAGE_FINANCE), [idParam, validate], async (req, res) => {
    await transparencyService.removeDocument(req.user, req.params.id);
    res.json({ message: "Document supprimé" });
});

// ---------- Portraits publics de l'equipe (RH) ----------

const profileValidation = [
    body("publicProfile").optional().isIn(["0", "1", "true", "false", true, false]),
    body("title").optional({ values: "null" }).isString().trim().isLength({ max: 120 }),
    body("bio").optional({ values: "null" }).isString().trim().isLength({ max: 600 }),
    validate,
];

const profilePayload = (req) => ({
    publicProfile: req.body.publicProfile === undefined ? undefined : flag(req.body.publicProfile),
    title: req.body.title || null,
    bio: req.body.bio || null,
});

router.get("/team", can(P.MANAGE_HR), async (req, res) => {
    res.json(await transparencyService.listTeamProfiles(req.user));
});

router.patch(
    "/team/:id",
    can(P.MANAGE_HR),
    upload.single("image"),
    [idParam, ...profileValidation],
    async (req, res) => {
        res.json(await transparencyService.updateTeamProfile(req.user, req.params.id, profilePayload(req), req.file, {
            removePhoto: flag(req.body.removePhoto),
        }));
    }
);

module.exports = { basePath: "/api/transparency/admin", router, profileValidation, profilePayload };
