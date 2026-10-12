// Transparence publique : chiffres des annees publiees, carte des regions, portraits de
// l'equipe. Agregats uniquement, mis en cache 5 minutes (memoire + Cache-Control).
// Le portrait de la personne connectee (consentement, photo, bio) se gere aussi ici.
const express = require("express");
const requireAuth = require("../../middlewares/authMiddleware");
const upload = require("../../middlewares/uploadMiddleware");
const transparencyService = require("../../services/transparencyService");
const { profileValidation, profilePayload } = require("./transparency-admin");

const router = express.Router();

const flag = (value) => value === true || value === "1" || value === "true" || value === "on";

// Reponses publiques identiques pour tous : partageables par les caches intermediaires.
function publicCache(res) {
    const seconds = Math.max(0, transparencyService.CACHE_SECONDS);
    res.setHeader("Cache-Control", seconds ? `public, max-age=${seconds}, stale-while-revalidate=60` : "no-cache");
}

router.get("/", async (_req, res) => {
    publicCache(res);
    res.json(await transparencyService.getIndex());
});

router.get("/regions", async (_req, res) => {
    publicCache(res);
    res.json(await transparencyService.getRegions());
});

router.get("/team", async (_req, res) => {
    publicCache(res);
    res.json(await transparencyService.getPublicTeam());
});

// Portrait public de la personne connectee (consentement explicite).
router.get("/team/me", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await transparencyService.getOwnProfile(req.user));
});

router.patch("/team/me", requireAuth, upload.single("image"), profileValidation, async (req, res) => {
    res.json(await transparencyService.updateOwnProfile(req.user, profilePayload(req), req.file, {
        removePhoto: flag(req.body.removePhoto),
    }));
});

// GET /api/transparency/2025 : 404 tant que l'annee n'est pas publiee.
router.get("/:year", async (req, res, next) => {
    if (!/^\d{4}$/.test(req.params.year)) return next();
    const data = await transparencyService.getPublicYear(req.params.year);
    publicCache(res);
    res.json(data);
});

module.exports = { basePath: "/api/transparency", router };
