// Referentiels du module "engagement" (consentements, CRM donateurs, campagnes, double
// authentification), partages par l'API et le site : require("@hope/shared/engagement").

// Sujets de communication non transactionnels.
const CONSENT_TOPICS = ["newsletter", "project_news", "donation_reminders", "event_reminders"];

// Sujets exigeant un accord explicite (opt-in) : sans accord enregistre, aucun envoi.
// Les autres sont autorises tant que la personne ne les a pas refuses (opt-out).
const OPT_IN_TOPICS = ["newsletter"];

// Origine d'un accord ou d'un retrait (preuve du consentement).
const CONSENT_SOURCES = [
    "register",
    "donation",
    "account",
    "preferences_link",
    "unsubscribe_link",
    "newsletter_form",
    "admin",
];

// Version par defaut des textes de consentement affiches (surchargeable par CONSENT_TEXT_VERSION).
// A changer a chaque modification des textes, pour savoir quel texte une personne a accepte.
const DEFAULT_CONSENT_TEXT_VERSION = "2026-10-v1";

// Segments du CRM donateurs.
const DONOR_SEGMENTS = ["all", "recurring", "inactive", "diaspora_eur", "major", "region"];
// Seuil par defaut d'un "grand donateur" (total en EUR, XAF converti), surchargeable.
const DEFAULT_MAJOR_DONOR_THRESHOLD_EUR = 1000;
// Inactivite : aucun don depuis ce nombre de mois.
const INACTIVE_DONOR_MONTHS = 12;

// Audiences d'une campagne : abonnes newsletter ou segment du CRM.
const CAMPAIGN_AUDIENCES = ["newsletter", ...DONOR_SEGMENTS.map((segment) => `donors:${segment}`)];
const CAMPAIGN_STATUSES = ["draft", "sending", "sent"];
// Variables utilisables dans les modeles et campagnes.
const TEMPLATE_VARIABLES = ["prenom", "nom"];

// Double authentification (TOTP RFC 6238).
const TOTP = { digits: 6, period: 30, algorithm: "SHA1", window: 1 };
// Permissions rendant la double authentification obligatoire (surchargeable par MFA_REQUIRED_PERMISSIONS).
const DEFAULT_MFA_REQUIRED_PERMISSIONS = ["manage_finance", "manage_user_roles", "delete_users", "manage_it"];
const BACKUP_CODES_COUNT = 10;

// Remplace {prenom} et {nom} ; une variable inconnue reste telle quelle.
function renderTemplate(text, { name = "" } = {}) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    const values = { prenom: parts[0] || "", nom: parts.slice(1).join(" ") };
    return String(text || "").replace(/\{(prenom|nom)\}/g, (_match, key) => values[key]);
}

function isOptInTopic(topic) {
    return OPT_IN_TOPICS.includes(topic);
}

// Cle d'un donateur : compte si le don y est rattache, sinon email.
function donorKey({ userId, email }) {
    if (userId) return `u:${Number(userId)}`;
    return email ? `e:${String(email).trim().toLowerCase()}` : null;
}

function parseDonorKey(key) {
    const match = /^(u|e):(.+)$/.exec(String(key || ""));
    if (!match) return null;
    if (match[1] === "u") {
        const id = Number(match[2]);
        return Number.isInteger(id) && id > 0 ? { userId: id } : null;
    }
    const email = match[2].trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+$/.test(email) ? { email } : null;
}

module.exports = {
    CONSENT_TOPICS,
    OPT_IN_TOPICS,
    CONSENT_SOURCES,
    DEFAULT_CONSENT_TEXT_VERSION,
    DONOR_SEGMENTS,
    DEFAULT_MAJOR_DONOR_THRESHOLD_EUR,
    INACTIVE_DONOR_MONTHS,
    CAMPAIGN_AUDIENCES,
    CAMPAIGN_STATUSES,
    TEMPLATE_VARIABLES,
    TOTP,
    DEFAULT_MFA_REQUIRED_PERMISSIONS,
    BACKUP_CODES_COUNT,
    renderTemplate,
    isOptInTopic,
    donorKey,
    parseDonorKey,
};
