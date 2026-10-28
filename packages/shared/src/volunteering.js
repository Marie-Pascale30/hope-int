// Benevolat, validation des contenus et evenements : referentiels partages par l'API et le site.
// Fonctions pures (aucun acces a la base) : les badges sont calcules a la volee, sans table.

// Workflow de validation des contenus (projets, actualites, temoignages).
// draft -> submitted -> approved | rejected ; approved -> published (l'approbation publie par defaut).
// Seul "published" est visible sur le site public (colonne published = 1).
const CONTENT_REVIEW_STATUSES = ["draft", "submitted", "approved", "rejected", "published"];
const REVIEWABLE_CONTENT_TYPES = ["projects", "news", "testimonials"];

// Appel des participants a un evenement.
const ATTENDANCE_STATUSES = ["present", "absent"];

// Statut d'un membre vis-a-vis d'un evenement.
const EVENT_PARTICIPATION_STATUSES = ["registered", "waitlisted"];

// Public d'un evenement : les evenements benevoles sont reserves aux invites (comptes crees depuis le
// site par des non-membres) ; les evenements internes (assemblee generale, reunions) aux membres.
const EVENT_AUDIENCES = ["volunteers", "members"];
const GUEST_ROLE = "invite";

// Un compte est membre des qu'il a un role autre qu'invite (membre, equipe).
const isGuestOnly = (roles = []) => roles.length > 0 && roles.every((role) => role === GUEST_ROLE);

// Le compte peut-il s'inscrire a un evenement de ce public ?
function canJoinAudience(roles = [], audience = "volunteers") {
    if (audience === "members") return roles.some((role) => role !== GUEST_ROLE);
    return roles.includes(GUEST_ROLE);
}

// Bornes de saisie des heures.
const HOURS_LIMITS = {
    // Heures hors evenement : une saisie par mission et par jour.
    entryMin: 0.25,
    entryMax: 24,
    // Presence a un evenement (peut durer plusieurs jours).
    eventMax: 100,
};

// Duree par defaut (heures) d'un evenement sans date de fin.
const DEFAULT_EVENT_HOURS = 2;

// Badges, du plus accessible au plus exigeant. metric : grandeur comparee au seuil.
//   activities : participations (evenement present ou mission saisie)
//   hours      : heures cumulees
//   events     : evenements avec presence
//   days       : jours depuis le premier engagement
const BADGES = [
    { key: "first_step", metric: "activities", threshold: 1 },
    { key: "hours_10", metric: "hours", threshold: 10 },
    { key: "events_5", metric: "events", threshold: 5 },
    { key: "hours_50", metric: "hours", threshold: 50 },
    { key: "one_year", metric: "days", threshold: 365 },
    { key: "hours_100", metric: "hours", threshold: 100 },
];

const DAY_MS = 24 * 3600 * 1000;

// Arrondi au quart d'heure (heures saisies ou calculees).
function roundHours(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return Math.round(number * 4) / 4;
}

// Duree d'un evenement en heures (fin - debut), arrondie au quart d'heure ; duree par defaut sans
// fin ; plafonnee a HOURS_LIMITS.eventMax.
function eventDurationHours(startAt, endAt) {
    if (!startAt || !endAt) return DEFAULT_EVENT_HOURS;
    const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_EVENT_HOURS;
    return Math.min(HOURS_LIMITS.eventMax, Math.max(0.25, roundHours(ms / 3600000)));
}

// Badges a partir des totaux d'un benevole.
// totals : { hours, events, activities, firstActivityAt } ; now : date de reference.
// Renvoie chaque badge avec { key, metric, threshold, value, earned, progress (0-100) }.
function computeBadges(totals = {}, now = new Date()) {
    const first = totals.firstActivityAt ? new Date(totals.firstActivityAt).getTime() : null;
    const values = {
        activities: Number(totals.activities) || 0,
        hours: Number(totals.hours) || 0,
        events: Number(totals.events) || 0,
        days: first && Number.isFinite(first) ? Math.max(0, Math.floor((new Date(now).getTime() - first) / DAY_MS)) : 0,
    };
    return BADGES.map((badge) => {
        const value = values[badge.metric];
        return {
            ...badge,
            value,
            earned: value >= badge.threshold,
            progress: Math.min(100, Math.round((value / badge.threshold) * 100)),
        };
    });
}

const earnedBadgeKeys = (totals, now) => computeBadges(totals, now).filter((badge) => badge.earned).map((badge) => badge.key);

// Code de verification d'une attestation : HOPE-XXXX-XXXX-XXXX (alphabet sans caracteres ambigus).
const CERTIFICATE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CERTIFICATE_CODE_PATTERN = /^HOPE-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

// Normalise une saisie (minuscules, espaces, tirets manquants) ; null si invalide.
function normalizeCertificateCode(input) {
    const raw = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const body = raw.startsWith("HOPE") ? raw.slice(4) : raw;
    if (body.length !== 12) return null;
    const code = `HOPE-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
    return CERTIFICATE_CODE_PATTERN.test(code) ? code : null;
}

module.exports = {
    CONTENT_REVIEW_STATUSES,
    REVIEWABLE_CONTENT_TYPES,
    ATTENDANCE_STATUSES,
    EVENT_PARTICIPATION_STATUSES,
    EVENT_AUDIENCES,
    GUEST_ROLE,
    isGuestOnly,
    canJoinAudience,
    HOURS_LIMITS,
    DEFAULT_EVENT_HOURS,
    BADGES,
    roundHours,
    eventDurationHours,
    computeBadges,
    earnedBadgeKeys,
    CERTIFICATE_CODE_ALPHABET,
    CERTIFICATE_CODE_PATTERN,
    normalizeCertificateCode,
};
