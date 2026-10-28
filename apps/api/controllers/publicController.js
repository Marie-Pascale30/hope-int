const contentService = require("../services/contentService");
const impactService = require("../services/impactService");
const paymentService = require("../services/paymentService");
const messageService = require("../services/messageService");
const applicationService = require("../services/applicationService");
const eventService = require("../services/eventService");
const { INTEREST_AREAS } = require("@hope/shared/applications");
const { REGIONS, XAF_PER_EUR, DONATION_LIMITS, PROJECT_STATUSES } = require("@hope/shared/constants");

exports.getMeta = async (_req, res) => {
    res.json({
        regions: REGIONS,
        projectStatuses: PROJECT_STATUSES,
        // Poles d'interet proposes dans une candidature (preferences indicatives, sans valeur de droit).
        interestAreas: INTEREST_AREAS.map(({ value, label }) => ({ value, label })),
        providers: paymentService.getProviders(),
        donationLimits: DONATION_LIMITS,
        xafPerEur: XAF_PER_EUR,
        organization: organization(),
    });
};

// Coordonnees publiques de l'association (page contact, pied de page) ; chaque valeur est surchargeable.
const list = (raw) => (raw || "").split(",").map((value) => value.trim()).filter(Boolean);

function organization() {
    const env = process.env;
    const phones = list(env.ORG_CONTACT_PHONES ?? "+237 694 63 25 60, +237 699 94 33 29, +237 677 86 57 43, +237 699 91 33 77, +1 630-597-5049");
    return {
        name: env.ORG_NAME || "HOPE International Project",
        email: env.ORG_CONTACT_EMAIL || "hopeinternationalproject@gmail.com",
        phone: env.ORG_CONTACT_PHONE || phones[0] || "",
        phones,
        address: env.ORG_ADDRESS || "Bonadibong, Akwa, Douala, Cameroun",
        poBox: env.ORG_PO_BOX ?? "B.P. 12695",
        president: env.ORG_PRESIDENT ?? "Mabelle NZEMTCHOU FOTSO",
        // Dons directs hors plateforme (numeros publies par l'association).
        mobileMoney: {
            mtn: env.ORG_MOMO_MTN ?? "679 15 22 53",
            orangeUssd: env.ORG_MOMO_ORANGE_USSD ?? "#150*47#",
            orangeMerchantCode: env.ORG_MOMO_ORANGE_CODE ?? "747603",
            sara: env.ORG_SARA_ACCOUNT ?? "07881731101 26",
        },
    };
}

// Cache memoire de 60 s (voir impactService).
exports.getImpact = async (_req, res) => {
    res.json(await impactService.getImpact());
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
    const { name, email, phone, region, motivation, interests } = req.body;
    // Reponse neutre : identique que l'email corresponde ou non a un compte ou a une candidature.
    await applicationService.submit({ name, email, phone, region, motivation, interests });
    res.status(201).json({ message: "Candidature envoyée" });
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
