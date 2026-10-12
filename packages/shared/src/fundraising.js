// Referentiels de la collecte de fonds (dons etendus), partages par l'API et le site.
// Importable via require("@hope/shared/fundraising") ou import { ... } from "@hope/shared/fundraising".

// Dons en hommage : en l'honneur de / a la memoire de.
const TRIBUTE_TYPES = ["honor", "memory"];
const TRIBUTE_LIMITS = { name: 120, message: 300, email: 180 };

// Dons hors ligne saisis par la finance.
const OFFLINE_KINDS = ["cash", "transfer", "check", "in_kind"];
const OFFLINE_STATUSES = ["pending_validation", "validated", "rejected"];

// Engagements de don mensuel Mobile Money.
const PLEDGE_STATUSES = ["active", "paused", "stopped"];
const PLEDGE_DAY_RANGE = { min: 1, max: 28 };
const PLEDGE_CHANNELS = ["email"];

// Collectes personnelles.
const FUNDRAISER_STATUSES = ["pending", "published", "rejected", "closed"];
const FUNDRAISER_LIMITS = { title: 120, story: 5000, storyMin: 50 };
const FUNDRAISER_GOAL = { eur: { min: 50, max: 100000 }, xaf: { min: 25000, max: 65000000 } };

// Source d'un don (?ref=) : 60 caracteres, lettres minuscules, chiffres, tiret, souligne, point.
const SOURCE_MAX_LENGTH = 60;

function cleanSource(value) {
    if (typeof value !== "string") return null;
    const cleaned = value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
        .slice(0, SOURCE_MAX_LENGTH)
        .replace(/[-.]+$/g, "");
    return cleaned || null;
}

// Sources ecrites par la plateforme elle-meme (liens de partage et de relance).
const SOURCES = {
    shareWhatsapp: "partage-whatsapp",
    shareFacebook: "partage-facebook",
    shareLink: "partage-lien",
    shareNative: "partage",
    reminder: "relance",
    pledge: "engagement",
    fundraiser: "collecte",
};

module.exports = {
    TRIBUTE_TYPES,
    TRIBUTE_LIMITS,
    OFFLINE_KINDS,
    OFFLINE_STATUSES,
    PLEDGE_STATUSES,
    PLEDGE_DAY_RANGE,
    PLEDGE_CHANNELS,
    FUNDRAISER_STATUSES,
    FUNDRAISER_LIMITS,
    FUNDRAISER_GOAL,
    SOURCE_MAX_LENGTH,
    SOURCES,
    cleanSource,
};
