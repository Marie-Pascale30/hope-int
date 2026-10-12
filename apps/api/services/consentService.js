// Preferences de communication et consentements (RGPD) :
// - newsletter : accord explicite obligatoire (double opt-in pour une inscription publique) ;
// - autres sujets : autorises tant que la personne ne les a pas refuses ;
// - liens signes (sans connexion) pour gerer ses choix ou se desinscrire depuis un email.
const consentRepo = require("../repositories/consentRepository");
const userRepo = require("../repositories/userRepository");
const logService = require("./activityLogService");
const tokens = require("./engagementTokens");
const { CONSENT_TOPICS, CONSENT_SOURCES, DEFAULT_CONSENT_TEXT_VERSION, isOptInTopic } = require("@hope/shared/engagement");
const { FRONTEND_URL } = require("../utils/security");
const { badRequest } = require("../utils/httpError");

const DAY = 24 * 3600;
const PREFERENCES_TTL_DAYS = () => Number(process.env.PREFERENCES_LINK_TTL_DAYS || 730);
const NEWSLETTER_CONFIRM_TTL = 7 * DAY;

const textVersion = () => process.env.CONSENT_TEXT_VERSION || DEFAULT_CONSENT_TEXT_VERSION;
const normalizeEmail = (email) => (email ? String(email).trim().toLowerCase() : null);
const localePrefix = (locale) => (locale && locale !== "fr" ? `/${locale}` : "");

const invalidLink = () => badRequest("Ce lien n'est plus valide. Utilisez le lien d'un email plus récent.", { code: "LINK_INVALID" });

function assertTopic(topic) {
    if (!CONSENT_TOPICS.includes(topic)) throw badRequest("Sujet de communication inconnu");
}

// Valeur par defaut d'un sujet sans decision enregistree.
const defaultFor = (topic) => !isOptInTopic(topic);

// Etat courant de chaque sujet : { newsletter: false, project_news: true, ... }.
async function preferencesFor({ email, userId }) {
    const latest = await consentRepo.latestFor({ email: normalizeEmail(email), userId });
    return Object.fromEntries(
        CONSENT_TOPICS.map((topic) => [topic, latest[topic] ? latest[topic].granted : defaultFor(topic)])
    );
}

exports.preferencesFor = preferencesFor;
exports.textVersion = textVersion;

// Le destinataire accepte-t-il ce sujet ? Compte anonymise ou desactive : jamais.
exports.canContact = async (email, topic) => {
    const address = normalizeEmail(email);
    if (!address || !CONSENT_TOPICS.includes(topic)) return false;
    const user = await userRepo.findByEmail(address);
    if (user && user.status !== "active") return false;
    const latest = await consentRepo.latestFor({ email: address, userId: user?.id });
    return latest[topic] ? latest[topic].granted : defaultFor(topic);
};

// Enregistre uniquement les sujets dont la valeur change. Renvoie les sujets modifies.
async function applyChanges({ email, userId }, topics, { source, ref = null }) {
    if (!CONSENT_SOURCES.includes(source)) throw new Error(`source de consentement inconnue : ${source}`);
    const current = await preferencesFor({ email, userId });
    const changed = [];
    for (const [topic, value] of Object.entries(topics || {})) {
        if (!CONSENT_TOPICS.includes(topic) || typeof value !== "boolean") continue;
        if (current[topic] === value) continue;
        await consentRepo.record({ userId, email: normalizeEmail(email), topic, granted: value, source, textVersion: textVersion(), ref });
        changed.push(topic);
    }
    return changed;
}

exports.applyChanges = applyChanges;

// --- Liens signes ---

exports.preferencesToken = (email, { campaignId } = {}) =>
    tokens.sign("prefs", { e: normalizeEmail(email), ...(campaignId ? { c: Number(campaignId) } : {}) }, { ttlSeconds: PREFERENCES_TTL_DAYS() * DAY });

exports.preferencesUrl = (email, { topic, campaignId, locale } = {}) => {
    const token = exports.preferencesToken(email, { campaignId });
    return `${FRONTEND_URL}${localePrefix(locale)}/preferences?token=${encodeURIComponent(token)}${topic ? `&sujet=${topic}` : ""}`;
};

// Pied des emails non transactionnels (en francais, comme les autres emails).
exports.unsubscribeFooter = (email, topic, { campaignId } = {}) => {
    if (!email) return "";
    const url = exports.preferencesUrl(email, { topic, campaignId });
    const labels = {
        newsletter: "la lettre d'information",
        project_news: "les nouvelles des projets que vous soutenez",
        donation_reminders: "les rappels liés à vos dons",
        event_reminders: "les rappels d'événements",
    };
    return [
        "",
        "--",
        `Vous recevez ce message car vous êtes inscrit(e) à ${labels[topic] || "nos communications"}.`,
        `Se désinscrire ou gérer vos préférences (sans connexion) : ${url}`,
    ].join("\n");
};

function readPreferencesToken(token) {
    const payload = tokens.verify(token, "prefs");
    if (!payload?.e) throw invalidLink();
    return payload;
}

const maskEmail = (email) => {
    const [local, domain] = String(email).split("@");
    return `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
};

exports.getByToken = async (token) => {
    const { e: email } = readPreferencesToken(token);
    const user = await userRepo.findByEmail(email);
    return { email: maskEmail(email), topics: await preferencesFor({ email, userId: user?.id }) };
};

exports.updateByToken = async (token, topics) => {
    const { e: email, c: campaignId } = readPreferencesToken(token);
    const user = await userRepo.findByEmail(email);
    const changed = await applyChanges({ email, userId: user?.id || null }, topics, {
        source: "preferences_link",
        ref: campaignId ? `campaign:${campaignId}` : null,
    });
    if (changed.length) await logService.log({ userId: user?.id || null, action: "consent.updated", meta: { source: "preferences_link", topics: changed } });
    return { email: maskEmail(email), topics: await preferencesFor({ email, userId: user?.id }) };
};

// Desinscription en un clic : un sujet, ou tous ("all").
exports.unsubscribeByToken = async (token, topic) => {
    if (topic !== "all") assertTopic(topic);
    const { e: email, c: campaignId } = readPreferencesToken(token);
    const user = await userRepo.findByEmail(email);
    const topics = Object.fromEntries((topic === "all" ? CONSENT_TOPICS : [topic]).map((name) => [name, false]));
    const changed = await applyChanges({ email, userId: user?.id || null }, topics, {
        source: "unsubscribe_link",
        ref: campaignId ? `campaign:${campaignId}` : null,
    });
    if (changed.length) await logService.log({ userId: user?.id || null, action: "consent.unsubscribed", meta: { topics: changed, campaignId: campaignId || undefined } });
    return { email: maskEmail(email), topics: await preferencesFor({ email, userId: user?.id }) };
};

// --- Espace membre ---

exports.getForUser = async (user) => ({ topics: await preferencesFor({ email: user.email, userId: user.id }), textVersion: textVersion() });

exports.updateForUser = async (user, topics) => {
    const changed = await applyChanges({ email: user.email, userId: user.id }, topics, { source: "account" });
    if (changed.length) await logService.log({ userId: user.id, action: "consent.updated", meta: { source: "account", topics: changed } });
    return exports.getForUser(user);
};

// --- Formulaires (inscription, don) ---
// consents : { newsletter: true, project_news: false, ... } (cases cochees ou non).
// La newsletter demandee depuis un formulaire public passe par la double confirmation par email ;
// les autres sujets sont enregistres tels quels.
exports.recordFromForm = async ({ email, userId = null, consents, source, locale = "fr" }) => {
    if (!consents || typeof consents !== "object") return { changed: [], confirmationSent: false };
    const { newsletter, ...others } = consents;
    const changed = await applyChanges({ email, userId }, others, { source });
    let confirmationSent = false;
    if (newsletter === true && !(await preferencesFor({ email, userId })).newsletter) {
        await exports.requestNewsletter(email, locale, { silentLog: true });
        confirmationSent = true;
    }
    return { changed, confirmationSent };
};

// --- Newsletter (double opt-in) ---

exports.requestNewsletter = async (email, locale = "fr", { silentLog = false } = {}) => {
    const address = normalizeEmail(email);
    const user = await userRepo.findByEmail(address);
    if ((await preferencesFor({ email: address, userId: user?.id })).newsletter) return { alreadySubscribed: true };
    const token = tokens.sign("newsletter", { e: address, l: locale }, { ttlSeconds: NEWSLETTER_CONFIRM_TTL });
    const confirmUrl = `${FRONTEND_URL}${localePrefix(locale)}/newsletter/confirmer?token=${encodeURIComponent(token)}`;
    // Charge a la demande : emailService utilise lui-meme ce module (pied de page).
    await require("./emailService").sendNewsletterConfirmationEmail({ to: address, confirmUrl });
    if (!silentLog) await logService.log({ action: "consent.newsletter_requested" });
    return { alreadySubscribed: false };
};

exports.confirmNewsletter = async (token) => {
    const payload = tokens.verify(token, "newsletter");
    if (!payload?.e) throw invalidLink();
    const user = await userRepo.findByEmail(payload.e);
    const changed = await applyChanges({ email: payload.e, userId: user?.id || null }, { newsletter: true }, { source: "newsletter_form" });
    if (changed.length) await logService.log({ userId: user?.id || null, action: "consent.newsletter_confirmed" });
    return { email: maskEmail(payload.e), subscribed: true };
};
