// Benevolat : compteur d'heures, historique et badges d'un membre ; saisie des heures hors
// evenement ; vue des benevoles par region (filtre, export CSV journalise).
const volunteerRepo = require("../repositories/volunteerRepository");
const logService = require("./activityLogService");
const { badRequest, notFound } = require("../utils/httpError");
const { getScopeRegion } = require("../utils/scope");
const { RECEIPT_TIMEZONE, dateParts } = require("../utils/timezone");
const { HOURS_LIMITS, computeBadges, roundHours } = require("@hope/shared/volunteering");

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

// --- Dates locales (fuseau des recus, defaut Africa/Douala) ---

// Decalage (ms) du fuseau par rapport a UTC a un instant donne.
function offsetAt(utcMs) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: RECEIPT_TIMEZONE, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs;
}

// Instant UTC de minuit local du jour "AAAA-MM-JJ" (dayOffset : jours ajoutes).
function localDayStart(day, dayOffset = 0) {
    const [year, month, date] = day.split("-").map(Number);
    const naive = Date.UTC(year, month - 1, date + dayOffset);
    return new Date(naive - offsetAt(naive));
}

// Jour local "AAAA-MM-JJ" d'un instant.
function localDay(value = new Date()) {
    const { year, month, day } = dateParts(value);
    return `${year}-${month}-${day}`;
}

// Periode [fromDate, toDate] (jours locaux inclus) -> bornes pour les requetes.
function periodBounds({ fromDate, toDate } = {}) {
    return {
        from: fromDate ? localDayStart(fromDate) : undefined,
        to: toDate ? localDayStart(toDate, 1) : undefined,
        fromDate,
        toDate,
    };
}

// --- Synthese d'un membre ---

// Totaux et historique (presences + missions) sur une periode facultative.
async function buildSummary(userId, period = {}) {
    const bounds = periodBounds(period);
    const [events, missions] = await Promise.all([
        volunteerRepo.getEventActivities(userId, bounds),
        volunteerRepo.getMissions(userId, bounds),
    ]);
    const history = [
        ...events.map((row) => ({
            kind: "event",
            id: `event-${row.event_id}`,
            event_id: row.event_id,
            title: row.title,
            date: new Date(row.start_at).toISOString(),
            location: row.location,
            region: row.region,
            hours: row.hours,
        })),
        ...missions.map((row) => ({
            kind: "mission",
            id: `mission-${row.id}`,
            mission_id: row.id,
            title: row.mission,
            // Jour local saisi : midi local pour un tri et un affichage stables.
            date: new Date(localDayStart(row.activity_date).getTime() + 12 * 3600 * 1000).toISOString(),
            day: row.activity_date,
            description: row.description,
            hours: row.hours,
        })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const eventHours = round2(events.reduce((sum, row) => sum + row.hours, 0));
    const otherHours = round2(missions.reduce((sum, row) => sum + row.hours, 0));
    const dates = history.map((item) => item.date).sort();
    const totals = {
        hours: round2(eventHours + otherHours),
        eventHours,
        otherHours,
        events: events.length,
        missions: missions.length,
        activities: history.length,
        firstActivityAt: dates[0] || null,
        lastActivityAt: dates[dates.length - 1] || null,
    };
    return { totals, history };
}

exports.buildSummary = buildSummary;
exports.localDay = localDay;

// Espace membre : compteur, badges, historique.
exports.getMine = async (user) => {
    const { totals, history } = await buildSummary(user.id);
    return { totals, badges: computeBadges(totals), history };
};

// --- Administration : heures hors evenement ---

exports.addHours = async (actor, { userId, mission, activityDate, hours, description }) => {
    const target = await volunteerRepo.findUser(userId);
    if (!target) throw notFound("Membre introuvable");
    const scopeRegion = getScopeRegion(actor);
    if (scopeRegion && target.region !== scopeRegion) throw notFound("Membre introuvable");
    const value = roundHours(hours);
    if (value < HOURS_LIMITS.entryMin || value > HOURS_LIMITS.entryMax) throw badRequest("Nombre d'heures invalide");
    if (activityDate > localDay()) throw badRequest("La date de la mission ne peut pas être dans le futur");
    const id = await volunteerRepo.createHours({
        userId,
        mission: mission.trim(),
        activityDate,
        hours: value,
        description: description ? description.trim() : null,
        createdBy: actor.id,
    });
    await logService.log({ userId: actor.id, action: "volunteer.hours_add", meta: { id, userId: Number(userId), hours: value } });
    return volunteerRepo.findHours(id);
};

exports.removeHours = async (actor, id) => {
    const entry = await volunteerRepo.findHours(id);
    if (!entry) throw notFound("Saisie d'heures introuvable");
    const scopeRegion = getScopeRegion(actor);
    if (scopeRegion) {
        const target = await volunteerRepo.findUser(entry.user_id);
        if (!target || target.region !== scopeRegion) throw notFound("Saisie d'heures introuvable");
    }
    await volunteerRepo.removeHours(id);
    await logService.log({
        userId: actor.id,
        action: "volunteer.hours_delete",
        meta: { id: Number(id), userId: entry.user_id, hours: entry.hours },
    });
};

// --- Administration : benevoles par region ---

function scopedFilters(actor, filters = {}) {
    const scopeRegion = getScopeRegion(actor);
    return {
        region: scopeRegion || filters.region || undefined,
        q: filters.q ? String(filters.q).trim().slice(0, 100) : undefined,
        engaged: filters.engaged === true || filters.engaged === "1" || filters.engaged === "true",
    };
}

exports.listVolunteers = async (actor, filters) => volunteerRepo.listVolunteers(scopedFilters(actor, filters));

// Fiche d'un benevole : synthese, badges et historique (avec les saisies supprimables).
exports.getVolunteer = async (actor, id) => {
    const target = await volunteerRepo.findUser(id);
    const scopeRegion = getScopeRegion(actor);
    if (!target || (scopeRegion && target.region !== scopeRegion)) throw notFound("Membre introuvable");
    const { totals, history } = await buildSummary(target.id);
    return { user: { id: target.id, name: target.name, region: target.region }, totals, badges: computeBadges(totals), history };
};

// Cellule CSV : separateur ";", guillemets echappes, formules neutralisees (Excel).
function csvCell(value) {
    const text = value === null || value === undefined ? "" : String(value);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const CSV_COLUMNS = [
    ["Nom", (row) => row.name],
    ["Email", (row) => row.email],
    ["Téléphone", (row) => row.phone],
    ["Région", (row) => row.region],
    ["Compétences", (row) => row.skills],
    ["Disponibilités", (row) => row.availability],
    ["Heures (total)", (row) => String(row.total_hours).replace(".", ",")],
    ["Heures (événements)", (row) => String(row.event_hours).replace(".", ",")],
    ["Heures (missions)", (row) => String(row.other_hours).replace(".", ",")],
    ["Événements", (row) => row.events_count],
    ["Missions", (row) => row.missions_count],
    ["Dernier engagement", (row) => (row.last_activity_at ? localDay(row.last_activity_at) : "")],
];

// Export nominatif (coordonnees personnelles) : journalise avec les filtres et le volume.
exports.exportVolunteers = async (actor, filters) => {
    const applied = scopedFilters(actor, filters);
    const rows = await volunteerRepo.listVolunteers(applied);
    const lines = [
        CSV_COLUMNS.map(([label]) => csvCell(label)).join(";"),
        ...rows.map((row) => CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(";")),
    ];
    await logService.log({
        userId: actor.id,
        action: "volunteer.export",
        meta: { count: rows.length, ...(applied.region ? { region: applied.region } : {}), ...(applied.q ? { q: applied.q } : {}), ...(applied.engaged ? { engaged: true } : {}) },
    });
    return { csv: String.fromCharCode(0xfeff) + lines.join("\r\n"), count: rows.length };
};
