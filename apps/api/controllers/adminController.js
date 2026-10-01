const adminService = require("../services/adminService");
const userService = require("../services/userService");
const messageService = require("../services/messageService");
const applicationService = require("../services/applicationService");
const paymentService = require("../services/paymentService");
const contentService = require("../services/contentService");
const eventService = require("../services/eventService");
const userRepo = require("../repositories/userRepository");

const pick = (source, keys) =>
    keys.reduce((acc, key) => (source[key] !== undefined && source[key] !== "" ? { ...acc, [key]: source[key] } : acc), {});

// --- Tableau de bord, roles, journal, systeme ---
exports.getStats = async (_req, res) => res.json(await adminService.getStats());
exports.getRoles = async (_req, res) => res.json(await adminService.getRoles());
exports.getLogs = async (req, res) => res.json(await adminService.getLogs(pick(req.query, ["limit", "offset", "action", "userId"])));
exports.getSystem = async (_req, res) => res.json(await adminService.getSystemStatus());
exports.getRegional = async (req, res) => res.json(await adminService.getRegional(req.user, req.query.region));
exports.getAnnualReport = async (req, res) => res.json(await adminService.getAnnualReport(req.query.year));

// --- Membres ---
exports.getUsers = async (req, res) => res.json(await userService.list(pick(req.query, ["region"])));

// Personnes a qui l'on peut assigner un message (equipe, hors simples membres).
exports.getStaff = async (_req, res) => {
    const users = await userRepo.getAll();
    res.json(users
        .filter((user) => user.status === "active" && user.roles.some((role) => role !== "membre"))
        .map(({ id, name, roles }) => ({ id, name, roles })));
};

exports.createUser = async (req, res) => {
    const result = await userService.createWithGeneratedPassword(req.user, req.body);
    res.status(201).json({ message: "Compte créé", ...result });
};

exports.updateUserRoles = async (req, res) => {
    const user = await userService.updateRoles(req.user, req.params.id, req.body.roles);
    res.json({ message: "Rôles mis à jour", user });
};

exports.updateUserProfile = async (req, res) => {
    const payload = {};
    ["phone", "region", "skills", "availability", "status"].forEach((key) => {
        if (req.body[key] !== undefined) payload[key] = req.body[key];
    });
    const user = await userService.updateProfile(req.user, req.params.id, payload);
    res.json({ message: "Fiche mise à jour", user });
};

exports.deleteUser = async (req, res) => {
    await userService.remove(req.user, req.params.id);
    res.json({ message: "Utilisateur supprimé" });
};

// --- Messages ---
exports.getMessages = async (req, res) => res.json(await messageService.list(pick(req.query, ["status"])));

exports.updateMessage = async (req, res) => {
    res.json(await messageService.update(req.user, req.params.id, req.body));
};

exports.deleteMessage = async (req, res) => {
    await messageService.remove(req.user, req.params.id);
    res.json({ message: "Message supprimé" });
};

// --- Candidatures ---
exports.getApplications = async (req, res) => res.json(await applicationService.list(pick(req.query, ["status"])));

exports.reviewApplication = async (req, res) => {
    res.json(await applicationService.markReviewing(req.user, req.params.id, req.body.reviewNote));
};

exports.rejectApplication = async (req, res) => {
    res.json(await applicationService.reject(req.user, req.params.id, req.body.reviewNote));
};

exports.acceptApplication = async (req, res) => {
    const result = await applicationService.accept(req.user, req.params.id, req.body);
    res.json({ message: "Candidature acceptée : compte créé", ...result });
};

// --- Dons et finance ---
const DONATION_FILTERS = ["status", "from", "to", "projectId", "provider"];

exports.getDonations = async (req, res) => res.json(await paymentService.getAll(pick(req.query, DONATION_FILTERS)));
exports.getFinanceSummary = async (req, res) => res.json(await paymentService.getSummary(pick(req.query, ["year"])));
exports.reconcile = async (req, res) => res.json(await paymentService.reconcile(req.user));

exports.exportDonations = async (req, res) => {
    const csv = await adminService.exportDonationsCsv(pick(req.query, DONATION_FILTERS));
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="dons-hope-${stamp}.csv"`);
    res.send(csv);
};

// --- Contenus ---
exports.getContent = async (req, res) => res.json(await contentService.getAdminList(req.params.type));

exports.createContent = async (req, res) => {
    res.status(201).json(await contentService.create(req.user, req.params.type, req.body, req.file));
};

exports.updateContent = async (req, res) => {
    res.json(await contentService.update(req.user, req.params.type, req.params.id, req.body, req.file));
};

exports.deleteContent = async (req, res) => {
    await contentService.remove(req.user, req.params.type, req.params.id);
    res.json({ message: "Contenu supprimé" });
};

// --- Evenements ---
exports.getEvents = async (_req, res) => res.json(await eventService.listAdmin());
exports.createEvent = async (req, res) => res.status(201).json(await eventService.create(req.user, req.body, req.file));
exports.updateEvent = async (req, res) => res.json(await eventService.update(req.user, req.params.id, req.body, req.file));

exports.deleteEvent = async (req, res) => {
    await eventService.remove(req.user, req.params.id);
    res.json({ message: "Événement supprimé" });
};

exports.getEventRegistrations = async (req, res) => res.json(await eventService.getRegistrations(req.params.id));
