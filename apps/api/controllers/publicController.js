const contentService = require("../services/contentService");
const contentRepo = require("../repositories/contentRepository");
const statsRepo = require("../repositories/statsRepository");
const paymentService = require("../services/paymentService");
const messageService = require("../services/messageService");
const applicationService = require("../services/applicationService");
const eventService = require("../services/eventService");
const { ROLE_LABELS } = require("@hope/shared/rbac");
const { REGIONS, XAF_PER_EUR, DONATION_LIMITS, PROJECT_STATUSES } = require("@hope/shared/constants");

exports.getMeta = async (_req, res) => {
    res.json({
        regions: REGIONS,
        projectStatuses: PROJECT_STATUSES,
        // Roles proposables dans une candidature (l'admin n'est jamais candidat).
        applicationRoles: Object.entries(ROLE_LABELS)
            .filter(([key]) => key !== "admin")
            .sort(([a], [b]) => (a === "membre" ? -1 : b === "membre" ? 1 : 0))
            .map(([value, label]) => ({ value, label })),
        providers: paymentService.getProviders(),
        donationLimits: DONATION_LIMITS,
        xafPerEur: XAF_PER_EUR,
        organization: {
            name: process.env.ORG_NAME || "HOPE International",
            email: process.env.ORG_CONTACT_EMAIL || "contact@hope-international.org",
            phone: process.env.ORG_CONTACT_PHONE || "",
            address: process.env.ORG_ADDRESS || "Douala, Cameroun",
        },
    });
};

exports.getImpact = async (_req, res) => {
    const [impact, donations] = await Promise.all([
        contentRepo.getImpactTotals(),
        statsRepo.getPublicDonationTotals(),
    ]);
    res.json({ ...impact, ...donations });
};

exports.listContent = async (req, res) => {
    res.json(await contentService.getPublicList(req.params.type, { region: req.query.region }));
};

exports.getContent = async (req, res) => {
    res.json(await contentService.getPublicItem(req.params.type, req.params.id));
};

exports.createMessage = async (req, res) => {
    const id = await messageService.createMessage(req.body);
    res.status(201).json({ message: "Message envoyé", id });
};

exports.createApplication = async (req, res) => {
    const id = await applicationService.submit(req.body);
    res.status(201).json({ message: "Candidature envoyée", id });
};

exports.listEvents = async (req, res) => {
    res.json(await eventService.listPublic({ region: req.query.region, userId: req.user?.id }));
};

exports.getEvent = async (req, res) => {
    res.json(await eventService.getPublic(req.params.id, req.user?.id));
};

exports.myEvents = async (req, res) => {
    res.json(await eventService.listForUser(req.user.id));
};

exports.registerEvent = async (req, res) => {
    res.status(201).json(await eventService.register(req.user, req.params.id));
};

exports.unregisterEvent = async (req, res) => {
    await eventService.unregister(req.user, req.params.id);
    res.json({ message: "Inscription annulée" });
};
