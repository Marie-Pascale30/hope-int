// Administration de la double authentification : etat par compte et reinitialisation
// (telephone perdu) par une personne pouvant gerer les roles (MANAGE_USER_ROLES).
const express = require("express");
const { param, query } = require("express-validator");
const auth = require("../../middlewares/authMiddleware");
const can = require("../../middlewares/permissionMiddleware");
const validate = require("../../middlewares/validateRequest");
const mfaService = require("../../services/engagementMfaService");
const userService = require("../../services/userService");
const userRepo = require("../../repositories/userRepository");
const { PERMISSIONS } = require("@hope/shared/rbac");

const router = express.Router();
router.use(mfaService.requireActive, auth, can(PERMISSIONS.MANAGE_USER_ROLES));

// Etat de la double authentification pour une liste de comptes (?ids=1,2,3).
router.get("/mfa", [query("ids").isString().matches(/^\d+(,\d+){0,199}$/), validate], async (req, res) => {
    const ids = req.query.ids.split(",").map(Number);
    const enabled = await mfaService.statusForUsers(ids);
    const users = await Promise.all(ids.map((userId) => userRepo.findById(userId)));
    res.json(users.filter(Boolean).map((user) => ({
        id: user.id,
        enabled: Boolean(enabled[user.id]),
        required: mfaService.isRequiredFor(user.roles),
    })));
});

router.post("/users/:id/mfa/reset", [param("id").isInt({ min: 1 }), validate], async (req, res) => {
    await mfaService.resetByAdmin(req.user, Number(req.params.id), { assertCanManage: userService.assertCanManage });
    res.json({ message: "Double authentification réinitialisée" });
});

module.exports = { basePath: "/api/engagement/security", router };
