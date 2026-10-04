// Referentiels metier partages par l'API et le site (exposes aussi via GET /api/meta).

const REGIONS = [
    "Adamaoua",
    "Centre",
    "Est",
    "Extrême-Nord",
    "Littoral",
    "Nord",
    "Nord-Ouest",
    "Ouest",
    "Sud",
    "Sud-Ouest",
];

// Parite fixe du franc CFA (XAF) avec l'euro.
const XAF_PER_EUR = 655.957;

const CURRENCIES = ["eur", "xaf"];

const PROJECT_STATUSES = ["planifie", "en_cours", "termine"];
const MESSAGE_STATUSES = ["nouveau", "lu", "traite", "archive"];
const APPLICATION_STATUSES = ["nouvelle", "en_etude", "acceptee", "refusee"];
const USER_STATUSES = ["active", "inactive"];
const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "canceled", "refunded", "disputed", "review"];
const SUCCESS_PAYMENT_STATUSES = ["succeeded", "completed"];

const DONATION_LIMITS = {
    eur: { min: 1, max: 100000 },
    xaf: { min: 500, max: 65000000 },
};

function toEur(amount, currency) {
    const value = Number(amount) || 0;
    return String(currency).toLowerCase() === "xaf" ? value / XAF_PER_EUR : value;
}

module.exports = {
    REGIONS,
    XAF_PER_EUR,
    CURRENCIES,
    PROJECT_STATUSES,
    MESSAGE_STATUSES,
    APPLICATION_STATUSES,
    USER_STATUSES,
    PAYMENT_STATUSES,
    SUCCESS_PAYMENT_STATUSES,
    DONATION_LIMITS,
    toEur,
};
