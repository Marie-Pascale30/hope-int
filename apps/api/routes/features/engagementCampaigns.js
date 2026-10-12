// Newsletter, campagnes, modeles et nouvelles des projets (permission MANAGE_CAMPAIGNS).
const express = require("express");
const { body, param } = require("express-validator");
const auth = require("../../middlewares/authMiddleware");
const can = require("../../middlewares/permissionMiddleware");
const validate = require("../../middlewares/validateRequest");
const campaignService = require("../../services/campaignService");
const { PERMISSIONS } = require("@hope/shared/rbac");

const router = express.Router();
router.use(auth, can(PERMISSIONS.MANAGE_CAMPAIGNS));

const id = (name = "id") => param(name).isInt({ min: 1 });
const content = [
    body("name").isString().trim().isLength({ min: 2, max: 150 }),
    body("subject").isString().trim().isLength({ min: 2, max: 200 }),
    body("body").isString().trim().isLength({ min: 2, max: 20000 }),
];
const campaignBody = [
    ...content,
    body("audience").optional().isString().isLength({ max: 60 }),
    body("topic").optional().isString().isLength({ max: 40 }),
    body("audienceParams").optional().isObject(),
];

// --- Abonnes et modeles ---

router.get("/subscribers", async (_req, res) => {
    res.json(await campaignService.newsletterSubscribers());
});

router.get("/templates", async (_req, res) => {
    res.json(await campaignService.listTemplates());
});

router.post("/templates", [...content, validate], async (req, res) => {
    res.status(201).json(await campaignService.createTemplate(req.user, req.body));
});

router.put("/templates/:id", [id(), ...content, validate], async (req, res) => {
    res.json(await campaignService.updateTemplate(req.user, req.params.id, req.body));
});

router.delete("/templates/:id", [id(), validate], async (req, res) => {
    await campaignService.removeTemplate(req.user, req.params.id);
    res.json({ message: "Modèle supprimé" });
});

// --- Nouvelles des projets ---

router.get("/project-news", async (_req, res) => {
    res.json(await campaignService.projectNewsCandidates());
});

router.get("/project-news/:id/preview", [id(), validate], async (req, res) => {
    res.json(await campaignService.previewProjectNews(req.params.id));
});

router.post("/project-news/:id/send", [id(), validate], async (req, res) => {
    res.json(await campaignService.sendProjectNews(req.user, req.params.id));
});

// --- Campagnes ---

router.get("/", async (_req, res) => {
    res.json(await campaignService.listCampaigns());
});

router.post("/", [...campaignBody, validate], async (req, res) => {
    res.status(201).json(await campaignService.createCampaign(req.user, req.body));
});

router.get("/:id", [id(), validate], async (req, res) => {
    res.json(await campaignService.getCampaign(req.params.id));
});

router.put("/:id", [id(), ...campaignBody, validate], async (req, res) => {
    res.json(await campaignService.updateCampaign(req.user, req.params.id, req.body));
});

router.delete("/:id", [id(), validate], async (req, res) => {
    await campaignService.removeCampaign(req.user, req.params.id);
    res.json({ message: "Campagne supprimée" });
});

router.get("/:id/preview", [id(), validate], async (req, res) => {
    res.json(await campaignService.preview(req.params.id));
});

router.post("/:id/test", [id(), validate], async (req, res) => {
    res.json(await campaignService.sendTest(req.user, req.params.id));
});

router.post("/:id/send", [id(), validate], async (req, res) => {
    res.json(await campaignService.send(req.user, req.params.id));
});

module.exports = { basePath: "/api/engagement/campaigns", router };
