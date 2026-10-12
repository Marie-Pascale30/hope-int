// Benevolat et evenements : heures et badges du membre, attestations (emission, PDF, verification
// publique), liste d'attente, appel des participants, heures hors evenement, benevoles par region.
const express = require("express");
const { body, param, query } = require("express-validator");
const auth = require("../../middlewares/authMiddleware");
const can = require("../../middlewares/permissionMiddleware");
const validate = require("../../middlewares/validateRequest");
const createLimiter = require("../../utils/rateLimit");
const { hasPermission, PERMISSIONS: P } = require("@hope/shared/rbac");
const { REGIONS } = require("@hope/shared/constants");
const { ATTENDANCE_STATUSES, HOURS_LIMITS } = require("@hope/shared/volunteering");
const volunteerService = require("../../services/volunteerService");
const certificateService = require("../../services/certificateService");
const attendanceService = require("../../services/attendanceService");
const waitlist = require("../../services/volunteerWaitlist");
const { localDay } = require("../../services/volunteerService");

const router = express.Router();

const idParam = param("id").isInt({ min: 1 }).toInt();
const day = (field) => body(field).optional({ values: "falsy" }).isISO8601({ strict: true }).bail().isLength({ min: 10, max: 10 });

// Au moins une des permissions (l'appel est ouvert a l'organisation et aux RH benevolat).
function canAny(...permissions) {
    return (req, res, next) => {
        const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        if (permissions.some((permission) => hasPermission(roles, permission))) return next();
        return res.status(403).json({ error: "Permission insuffisante", missingPermissions: permissions });
    };
}

// Verification publique : limite par adresse IP (evite l'enumeration des codes).
const verifyLimiter = createLimiter({
    windowMinutes: 15,
    max: 60,
    message: "Trop de vérifications depuis votre connexion : réessayez dans quelques minutes.",
});

// --- Public ---
router.get("/certificates/:code", verifyLimiter, [param("code").isString().isLength({ min: 12, max: 24 }), validate], async (req, res) => {
    res.json(await certificateService.verify(req.params.code));
});

// --- Membre connecte ---
router.get("/me", auth, async (req, res) => {
    const [summary, certificates] = await Promise.all([
        volunteerService.getMine(req.user),
        certificateService.listMine(req.user),
    ]);
    res.json({ ...summary, certificates, today: localDay() });
});

router.post("/me/certificates", auth, [day("from"), day("to"), validate], async (req, res) => {
    res.status(201).json(await certificateService.issue(req.user, { from: req.body.from || undefined, to: req.body.to || undefined }));
});

router.get("/me/certificates/:code/pdf", auth, [param("code").isString().isLength({ min: 12, max: 24 }), validate], async (req, res) => {
    const { buffer, code } = await certificateService.getPdf(req.user, req.params.code);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="attestation-benevolat-${code}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buffer);
});

// Liste d'attente d'un evenement complet.
router.post("/events/:id/waitlist", auth, [idParam, validate], async (req, res) => {
    res.status(201).json(await waitlist.join(req.user, req.params.id));
});

router.delete("/events/:id/waitlist", auth, [idParam, validate], async (req, res) => {
    await waitlist.leave(req.user, req.params.id);
    res.json({ message: "Vous avez quitté la liste d'attente" });
});

// --- Administration ---
const admin = express.Router();
admin.use(auth, can(P.ACCESS_ADMIN_DASHBOARD));

admin.get(
    "/events/:id/attendance",
    canAny(P.MANAGE_ORGANIZATION, P.MANAGE_VOLUNTEERS),
    [idParam, validate],
    async (req, res) => res.json(await attendanceService.getSheet(req.user, req.params.id))
);

admin.put(
    "/events/:id/attendance",
    canAny(P.MANAGE_ORGANIZATION, P.MANAGE_VOLUNTEERS),
    [
        idParam,
        body("entries").isArray({ min: 1, max: 1000 }).withMessage("Indiquez au moins un participant"),
        body("entries.*.userId").isInt({ min: 1 }).toInt(),
        body("entries.*.attendance").optional({ values: "null" }).isIn(ATTENDANCE_STATUSES),
        body("entries.*.hours").optional({ values: "null" }).isFloat({ min: 0, max: HOURS_LIMITS.eventMax }),
        validate,
    ],
    async (req, res) => res.json(await attendanceService.record(req.user, req.params.id, req.body.entries))
);

const volunteerFilters = [
    query("region").optional({ values: "falsy" }).isIn(REGIONS),
    query("q").optional().isString().trim().isLength({ max: 100 }),
    query("engaged").optional().isIn(["0", "1", "true", "false"]),
    validate,
];

admin.get("/volunteers", can(P.MANAGE_VOLUNTEERS), volunteerFilters, async (req, res) => {
    res.json(await volunteerService.listVolunteers(req.user, req.query));
});

admin.get("/volunteers/export", can(P.MANAGE_VOLUNTEERS), volunteerFilters, async (req, res) => {
    const { csv } = await volunteerService.exportVolunteers(req.user, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="benevoles-hope-${localDay()}.csv"`);
    res.send(csv);
});

admin.get("/volunteers/:id", can(P.MANAGE_VOLUNTEERS), [idParam, validate], async (req, res) => {
    res.json(await volunteerService.getVolunteer(req.user, req.params.id));
});

admin.post(
    "/hours",
    can(P.MANAGE_VOLUNTEERS),
    [
        body("userId").isInt({ min: 1 }).toInt(),
        body("mission").isString().trim().isLength({ min: 2, max: 255 }).withMessage("Indiquez la mission (2 à 255 caractères)"),
        body("activityDate").isISO8601({ strict: true }).bail().isLength({ min: 10, max: 10 }).withMessage("Date invalide"),
        body("hours").isFloat({ min: HOURS_LIMITS.entryMin, max: HOURS_LIMITS.entryMax }).withMessage("Nombre d'heures invalide"),
        body("description").optional({ values: "null" }).isString().trim().isLength({ max: 2000 }),
        validate,
    ],
    async (req, res) => res.status(201).json(await volunteerService.addHours(req.user, req.body))
);

admin.delete("/hours/:id", can(P.MANAGE_VOLUNTEERS), [idParam, validate], async (req, res) => {
    await volunteerService.removeHours(req.user, req.params.id);
    res.json({ message: "Saisie supprimée" });
});

router.use("/admin", admin);

module.exports = { basePath: "/api/volunteering", router };
