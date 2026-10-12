// CRM donateurs (permission MANAGE_DONORS) : liste agregee et segments, fiche, notes,
// etiquettes, export CSV journalise.
const express = require("express");
const { body, param } = require("express-validator");
const auth = require("../../middlewares/authMiddleware");
const can = require("../../middlewares/permissionMiddleware");
const validate = require("../../middlewares/validateRequest");
const donorService = require("../../services/donorService");
const { PERMISSIONS } = require("@hope/shared/rbac");

const router = express.Router();
router.use(auth, can(PERMISSIONS.MANAGE_DONORS));

const key = param("key").isString().isLength({ min: 3, max: 200 });

router.get("/", async (req, res) => {
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);
    const result = await donorService.list(req.query, { limit: pageSize, offset: (page - 1) * pageSize, sort: req.query.sort });
    res.json({ ...result, page, pageSize });
});

router.get("/export.csv", async (req, res) => {
    const csv = await donorService.exportCsv(req.user, req.query);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="donateurs-${req.query.segment || "all"}-${date}.csv"`);
    res.send(csv);
});

router.get("/:key", [key, validate], async (req, res) => {
    res.json(await donorService.get(req.user, req.params.key));
});

router.post("/:key/notes", [key, body("body").isString().trim().isLength({ min: 1, max: 5000 }).withMessage("La note est vide"), validate], async (req, res) => {
    res.status(201).json(await donorService.addNote(req.user, req.params.key, req.body.body));
});

router.delete("/:key/notes/:noteId", [key, param("noteId").isInt({ min: 1 }), validate], async (req, res) => {
    res.json(await donorService.removeNote(req.user, req.params.key, req.params.noteId));
});

router.put("/:key/tags", [key, body("tags").isArray({ max: 20 }), body("tags.*").isString().isLength({ min: 1, max: 40 }), validate], async (req, res) => {
    res.json({ tags: await donorService.setTags(req.user, req.params.key, req.body.tags) });
});

module.exports = { basePath: "/api/engagement/donors", router };
