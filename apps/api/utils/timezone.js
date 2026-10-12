// Fuseau fixe des recus et des bilans (RECEIPT_TIMEZONE, defaut Africa/Douala) : annee de
// numerotation, dates imprimees, bornes annuelles et regroupements mensuels ne dependent pas de
// l'horloge du serveur ni du fuseau UTC de la base. Fonctions pures, sans acces a la base.
const DEFAULT_TIMEZONE = "Africa/Douala";

function resolveTimezone(value) {
    try {
        new Intl.DateTimeFormat("fr-FR", { timeZone: value });
        return value;
    } catch (_error) {
        console.error(`RECEIPT_TIMEZONE invalide (${value}), utilisation de ${DEFAULT_TIMEZONE}`);
        return DEFAULT_TIMEZONE;
    }
}

const RECEIPT_TIMEZONE = resolveTimezone(process.env.RECEIPT_TIMEZONE || DEFAULT_TIMEZONE);

function dateParts(value, timeZone = RECEIPT_TIMEZONE) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(new Date(value));
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return { year: Number(get("year")), month: get("month"), day: get("day") };
}

function formatDate(value) {
    const { year, month, day } = dateParts(value);
    return `${day}/${month}/${year}`;
}

// Annee civile d'une date dans le fuseau des recus.
function receiptYear(value) {
    return dateParts(value).year;
}

// Mois "AAAA-MM" d'une date dans le fuseau des recus (regroupements mensuels des bilans).
function monthKey(value) {
    const { year, month } = dateParts(value);
    return `${year}-${month}`;
}

// Decalage (ms) du fuseau des recus par rapport a UTC a un instant donne.
function offsetAt(utcMs) {
    const local = new Intl.DateTimeFormat("en-US", {
        timeZone: RECEIPT_TIMEZONE, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const get = (type) => Number(local.find((part) => part.type === type).value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs;
}

// Instant UTC du debut (minuit local) du mois monthIndex (0-11, debordement accepte) de l'annee.
function monthStart(year, monthIndex) {
    const naive = Date.UTC(year, monthIndex, 1);
    return new Date(naive - offsetAt(naive));
}

// Bornes UTC [debut, fin[ d'une annee civile dans le fuseau des recus.
function yearBounds(year) {
    return { from: monthStart(year, 0), to: monthStart(year + 1, 0) };
}

// Debut du mois local situe monthsAgo mois avant le mois en cours (fenetres glissantes).
function monthStartAgo(monthsAgo, now = new Date()) {
    const { year, month } = dateParts(now);
    return monthStart(year, Number(month) - 1 - monthsAgo);
}

// Regroupements SQL : instant d'un quart d'heure UTC (tout decalage horaire reel en est un multiple).
const BUCKET_SQL = (column) => `FLOOR(UNIX_TIMESTAMP(${column}) / 900)`;

// Agrege par mois du fuseau des recus des lignes { bucket (quart d'heure UTC), ...valeurs }.
function groupByMonth(buckets, fields) {
    const months = new Map();
    for (const row of buckets) {
        const month = monthKey(Number(row.bucket) * 900 * 1000);
        const entry = months.get(month) || Object.fromEntries([["month", month], ...fields.map((field) => [field, 0])]);
        fields.forEach((field) => {
            entry[field] += Number(row[field] || 0);
        });
        months.set(month, entry);
    }
    return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

module.exports = {
    BUCKET_SQL,
    groupByMonth,
    RECEIPT_TIMEZONE,
    dateParts,
    formatDate,
    receiptYear,
    monthKey,
    monthStart,
    monthStartAgo,
    yearBounds,
};
