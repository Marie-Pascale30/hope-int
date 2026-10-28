// Newsletter, campagnes et nouvelles des projets (permission MANAGE_CAMPAIGNS).
// - modeles reutilisables (texte simple, variables {prenom} et {nom}) ;
// - campagne = sujet + contenu + audience (abonnes newsletter ou segment du CRM) + sujet de
//   consentement verifie pour chaque destinataire ; aperçu, envoi de test, envoi par lots via
//   la file email_outbox (reprise par le worker engagement-campaigns), statistiques ;
// - nouvelles des projets : une actualite publiee liee a un projet, envoyee une seule fois aux
//   donateurs de ce projet qui acceptent "project_news".
const campaignRepo = require("../repositories/campaignRepository");
const consentRepo = require("../repositories/consentRepository");
const donorRepo = require("../repositories/donorRepository");
const donorService = require("./donorService");
const outbox = require("./emailOutbox");
const emailService = require("./emailService");
const preferences = require("./preferences");
const logService = require("./activityLogService");
const { CAMPAIGN_AUDIENCES, CONSENT_TOPICS, renderTemplate } = require("@hope/shared/engagement");
const { badRequest, conflict, notFound } = require("../utils/httpError");
const { FRONTEND_URL } = require("../utils/security");

const ORG_NAME = () => process.env.ORG_NAME || "HOPE International Project";
const BATCH_SIZE = () => Math.max(1, Number(process.env.CAMPAIGN_BATCH_SIZE) || 200);

// --- Modeles ---

function templateData({ name, subject, body }) {
    const clean = { name: String(name || "").trim(), subject: String(subject || "").trim(), body: String(body || "").trim() };
    if (clean.name.length < 2 || clean.name.length > 150) throw badRequest("Nom du modèle : 2 à 150 caractères");
    if (clean.subject.length < 2 || clean.subject.length > 200) throw badRequest("Objet : 2 à 200 caractères");
    if (clean.body.length < 2 || clean.body.length > 20000) throw badRequest("Contenu : 2 à 20 000 caractères");
    return clean;
}

exports.listTemplates = () => campaignRepo.listTemplates();

exports.createTemplate = async (actor, payload) => {
    const id = await campaignRepo.createTemplate(templateData(payload), actor.id);
    await logService.log({ userId: actor.id, action: "campaign.template_created", meta: { templateId: id } });
    return campaignRepo.findTemplate(id);
};

exports.updateTemplate = async (actor, id, payload) => {
    if (!(await campaignRepo.updateTemplate(Number(id), templateData(payload)))) throw notFound("Modèle introuvable");
    await logService.log({ userId: actor.id, action: "campaign.template_updated", meta: { templateId: Number(id) } });
    return campaignRepo.findTemplate(Number(id));
};

exports.removeTemplate = async (actor, id) => {
    if (!(await campaignRepo.removeTemplate(Number(id)))) throw notFound("Modèle introuvable");
    await logService.log({ userId: actor.id, action: "campaign.template_deleted", meta: { templateId: Number(id) } });
};

// --- Campagnes ---

function campaignData(payload) {
    const base = templateData({ name: payload.name, subject: payload.subject, body: payload.body });
    const audience = payload.audience || "newsletter";
    if (!CAMPAIGN_AUDIENCES.includes(audience)) throw badRequest("Audience inconnue");
    const topic = payload.topic || "newsletter";
    if (!CONSENT_TOPICS.includes(topic)) throw badRequest("Sujet de communication inconnu");
    // Les abonnes newsletter ne sont contactes que sur le sujet "newsletter".
    if (audience === "newsletter" && topic !== "newsletter") throw badRequest("Les abonnés à la newsletter ne reçoivent que la newsletter");
    const params = payload.audienceParams || {};
    const audienceParams = {};
    if (audience.startsWith("donors:")) {
        const filters = donorService.normalizeFilters({ segment: audience.slice(7), region: params.region, tag: params.tag, threshold: params.threshold });
        if (filters.region) audienceParams.region = filters.region;
        if (filters.tag) audienceParams.tag = filters.tag;
        if (filters.segment === "major") audienceParams.threshold = filters.threshold;
    }
    return { ...base, audience, topic, audienceParams };
}

async function getCampaign(id) {
    const campaign = await campaignRepo.findCampaign(Number(id));
    if (!campaign) throw notFound("Campagne introuvable");
    return campaign;
}

// Destinataires potentiels (avant verification des preferences), dedoublonnes : [{ email, name }].
async function audienceOf(campaign) {
    if (campaign.audience === "newsletter") return consentRepo.grantedEmails("newsletter");
    const filters = donorService.normalizeFilters({ segment: campaign.audience.slice(7), ...campaign.audience_params });
    const { items } = await donorRepo.list(filters, { sort: "name" });
    const seen = new Set();
    return items
        .filter((donor) => donor.email && !String(donor.email).endsWith("@deleted.invalid"))
        .map((donor) => ({ email: String(donor.email).toLowerCase(), name: donor.name }))
        .filter((donor) => !seen.has(donor.email) && seen.add(donor.email));
}

async function contactable(campaign, people) {
    const allowed = [];
    for (const person of people) {
        if (await preferences.canContact(person.email, campaign.topic)) allowed.push(person);
    }
    return allowed;
}

exports.listCampaigns = () => campaignRepo.listCampaigns();

exports.getCampaign = async (id) => {
    const campaign = await getCampaign(id);
    return { ...campaign, stats: await exports.stats(campaign.id) };
};

exports.createCampaign = async (actor, payload) => {
    const id = await campaignRepo.createCampaign(campaignData(payload), actor.id);
    await logService.log({ userId: actor.id, action: "campaign.created", meta: { campaignId: id } });
    return exports.getCampaign(id);
};

exports.updateCampaign = async (actor, id, payload) => {
    await getCampaign(id);
    if (!(await campaignRepo.updateDraft(Number(id), campaignData(payload)))) throw conflict("Campagne déjà envoyée : elle ne peut plus être modifiée");
    await logService.log({ userId: actor.id, action: "campaign.updated", meta: { campaignId: Number(id) } });
    return exports.getCampaign(id);
};

exports.removeCampaign = async (actor, id) => {
    await getCampaign(id);
    if (!(await campaignRepo.removeDraft(Number(id)))) throw conflict("Campagne déjà envoyée : elle ne peut plus être supprimée");
    await logService.log({ userId: actor.id, action: "campaign.deleted", meta: { campaignId: Number(id) } });
};

const render = (campaign, person) => ({
    subject: renderTemplate(campaign.subject, person),
    text: renderTemplate(campaign.body, person),
});

exports.preview = async (id) => {
    const campaign = await getCampaign(id);
    const recipients = await contactable(campaign, await audienceOf(campaign));
    const sample = recipients[0] || { email: "exemple@example.org", name: "Camille Exemple" };
    const { subject, text } = render(campaign, sample);
    return {
        subject,
        text: await emailService.withUnsubscribeFooter({ to: sample.email, text, topic: campaign.topic, campaignId: campaign.id }),
        recipients: recipients.length,
    };
};

// Envoi de test a l'auteur de la demande (sans verification des preferences ni comptage).
exports.sendTest = async (actor, id) => {
    const campaign = await getCampaign(id);
    const { subject, text } = render(campaign, { name: actor.name });
    const result = await emailService.send({
        to: actor.email,
        subject: `[TEST] ${subject}`,
        text: await emailService.withUnsubscribeFooter({ to: actor.email, text, topic: campaign.topic, campaignId: campaign.id }),
    });
    await logService.log({ userId: actor.id, action: "campaign.test_sent", meta: { campaignId: campaign.id } });
    return { sent: Boolean(result?.sent), reason: result?.reason };
};

// Traite un lot de destinataires d'une campagne en cours d'envoi. Renvoie { queued, skipped, remaining }.
exports.processCampaign = async (id, { batchSize = BATCH_SIZE() } = {}) => {
    const campaign = await campaignRepo.findCampaign(Number(id));
    if (!campaign || campaign.status !== "sending") return { queued: 0, skipped: 0, remaining: 0 };
    const done = await campaignRepo.recipientEmails(campaign.id);
    const pending = (await audienceOf(campaign)).filter((person) => !done.has(person.email));
    const batch = pending.slice(0, batchSize);
    let queued = 0;
    let skipped = 0;
    for (const person of batch) {
        if (!(await campaignRepo.reserveRecipient(campaign.id, person.email))) continue;
        if (!(await preferences.canContact(person.email, campaign.topic))) {
            await campaignRepo.markRecipientSkipped(campaign.id, person.email);
            skipped += 1;
            continue;
        }
        const { subject, text } = render(campaign, person);
        const outboxId = await outbox.enqueue({
            kind: "campaign",
            to: person.email,
            subject,
            text: await emailService.withUnsubscribeFooter({ to: person.email, text, topic: campaign.topic, campaignId: campaign.id }),
        });
        await campaignRepo.setRecipientOutbox(campaign.id, person.email, outboxId);
        queued += 1;
    }
    const remaining = pending.length - batch.length;
    if (remaining <= 0) {
        await campaignRepo.markSent(campaign.id);
        await logService.log({ userId: campaign.created_by, action: "campaign.completed", meta: { campaignId: campaign.id, ...(await campaignRepo.stats(campaign.id)) } });
    }
    return { queued, skipped, remaining: Math.max(0, remaining) };
};

// Lancement : la campagne passe en envoi (une seule fois), un premier lot part tout de suite,
// la suite est traitee par le worker engagement-campaigns.
exports.send = async (actor, id) => {
    const campaign = await getCampaign(id);
    if (!(await campaignRepo.markSending(campaign.id))) throw conflict("Cette campagne a déjà été envoyée");
    await logService.log({ userId: actor.id, action: "campaign.sending", meta: { campaignId: campaign.id } });
    const batch = await exports.processCampaign(campaign.id);
    return { ...batch, campaign: await exports.getCampaign(campaign.id) };
};

exports.processPending = async () => {
    for (const id of await campaignRepo.sendingIds()) await exports.processCampaign(id);
};

exports.stats = async (id) => ({
    ...(await campaignRepo.stats(id)),
    unsubscribed: await consentRepo.countWithdrawnByRef(`campaign:${id}`),
});

exports.newsletterSubscribers = async () => {
    const subscribers = await consentRepo.grantedEmails("newsletter");
    return { total: subscribers.length };
};

// --- Nouvelles des projets ---

function projectNewsEmail(news, person) {
    const url = `${FRONTEND_URL}/actualites/${news.id}`;
    return {
        subject: `${ORG_NAME()} - Des nouvelles de « ${news.project_title} »`,
        text: [
            renderTemplate("Bonjour {prenom},", person).replace(" ,", ","),
            "",
            `Merci de soutenir le projet « ${news.project_title} ». Voici les dernières nouvelles :`,
            "",
            news.title,
            news.summary || String(news.content || "").slice(0, 600),
            "",
            `Lire la suite : ${url}`,
        ].join("\n"),
    };
}

exports.projectNewsCandidates = () => campaignRepo.projectNewsCandidates();

async function publishedNews(newsId) {
    const news = await campaignRepo.findPublishedNews(Number(newsId));
    if (!news) throw notFound("Actualité introuvable ou non publiée");
    return news;
}

async function projectNewsRecipients(news) {
    const donors = await donorRepo.projectDonors(news.project_id);
    const allowed = [];
    for (const donor of donors) {
        if (await preferences.canContact(donor.email, "project_news")) allowed.push(donor);
    }
    return allowed;
}

exports.previewProjectNews = async (newsId) => {
    const news = await publishedNews(newsId);
    const recipients = await projectNewsRecipients(news);
    const sample = recipients[0] || { email: "exemple@example.org", name: "Camille Exemple" };
    const { subject, text } = projectNewsEmail(news, sample);
    return {
        news: { id: news.id, title: news.title, project_id: news.project_id, project_title: news.project_title },
        subject,
        text: await emailService.withUnsubscribeFooter({ to: sample.email, text, topic: "project_news" }),
        recipients: recipients.length,
        dispatched: await campaignRepo.findDispatch(news.id),
    };
};

exports.sendProjectNews = async (actor, newsId) => {
    const news = await publishedNews(newsId);
    if (!(await campaignRepo.claimDispatch(news.id, news.project_id, actor.id))) {
        throw conflict("Cette actualité a déjà été envoyée aux donateurs du projet");
    }
    const recipients = await projectNewsRecipients(news);
    for (const person of recipients) {
        const { subject, text } = projectNewsEmail(news, person);
        await outbox.enqueue({
            kind: "project_news",
            to: person.email,
            subject,
            text: await emailService.withUnsubscribeFooter({ to: person.email, text, topic: "project_news" }),
        });
    }
    await campaignRepo.setDispatchRecipients(news.id, recipients.length);
    await logService.log({ userId: actor.id, action: "campaign.project_news_sent", meta: { newsId: news.id, projectId: news.project_id, recipients: recipients.length } });
    return { recipients: recipients.length };
};

// Espace membre : projets soutenus (progression et dernieres actualites).
exports.supportedProjects = (user) => campaignRepo.supportedProjects({ userId: user.id, email: user.email });
