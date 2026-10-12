// CRM donateurs leger (permission MANAGE_DONORS) : liste agregee, segments, fiche, notes,
// etiquettes et export CSV journalise.
const donorRepo = require("../repositories/donorRepository");
const consentService = require("./consentService");
const logService = require("./activityLogService");
const {
    DONOR_SEGMENTS, DEFAULT_MAJOR_DONOR_THRESHOLD_EUR, INACTIVE_DONOR_MONTHS, parseDonorKey,
} = require("@hope/shared/engagement");
const { REGIONS } = require("@hope/shared/constants");
const { badRequest, notFound } = require("../utils/httpError");

const majorThreshold = () => Number(process.env.MAJOR_DONOR_THRESHOLD_EUR) || DEFAULT_MAJOR_DONOR_THRESHOLD_EUR;

// Filtres valides (les valeurs inconnues sont ignorees ou refusees).
function normalizeFilters(query = {}) {
    const segment = query.segment || "all";
    if (!DONOR_SEGMENTS.includes(segment)) throw badRequest("Segment inconnu");
    const region = query.region || null;
    if (region && !REGIONS.includes(region)) throw badRequest("Région inconnue");
    if (segment === "region" && !region) throw badRequest("Choisissez une région");
    const threshold = query.threshold !== undefined && query.threshold !== "" ? Number(query.threshold) : majorThreshold();
    if (!Number.isFinite(threshold) || threshold < 0) throw badRequest("Seuil invalide");
    return {
        segment,
        region,
        q: query.q ? String(query.q).slice(0, 100) : null,
        tag: query.tag ? normalizeTag(query.tag) : null,
        threshold,
        inactiveMonths: INACTIVE_DONOR_MONTHS,
    };
}

exports.normalizeFilters = normalizeFilters;

function normalizeTag(tag) {
    return String(tag || "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
}

exports.list = async (query, { limit = 50, offset = 0, sort } = {}) => {
    const filters = normalizeFilters(query);
    const result = await donorRepo.list(filters, { limit, offset, sort });
    return { ...result, threshold: filters.threshold, tags: await donorRepo.allTags() };
};

function parseKey(key) {
    const identity = parseDonorKey(key);
    if (!identity) throw notFound("Donateur introuvable");
    return identity;
}

exports.get = async (actor, key) => {
    const identity = parseKey(key);
    const donor = await donorRepo.findByKey(key);
    if (!donor) throw notFound("Donateur introuvable");
    const [donations, events, notes, tags, preferences] = await Promise.all([
        donorRepo.donationsFor(identity.userId ? { userId: identity.userId } : { email: identity.email }),
        donorRepo.eventsFor(identity.userId),
        donorRepo.notesFor(key),
        donorRepo.tagsFor(key),
        donor.email ? consentService.preferencesFor({ email: donor.email, userId: identity.userId }) : {},
    ]);
    await logService.log({ userId: actor.id, action: "donor.view", meta: { donorKey: identity.userId ? key : "email" } });
    return { donor: { ...donor, tags }, donations, events, notes, preferences };
};

async function assertDonor(key) {
    parseKey(key);
    if (!(await donorRepo.findByKey(key))) throw notFound("Donateur introuvable");
}

exports.addNote = async (actor, key, body) => {
    await assertDonor(key);
    const text = String(body || "").trim();
    if (!text) throw badRequest("La note est vide");
    const id = await donorRepo.addNote(key, actor.id, text.slice(0, 5000));
    await logService.log({ userId: actor.id, action: "donor.note_added", meta: { noteId: id } });
    return donorRepo.notesFor(key);
};

exports.removeNote = async (actor, key, noteId) => {
    if (!(await donorRepo.removeNote(key, Number(noteId)))) throw notFound("Note introuvable");
    await logService.log({ userId: actor.id, action: "donor.note_deleted", meta: { noteId: Number(noteId) } });
    return donorRepo.notesFor(key);
};

exports.setTags = async (actor, key, tags) => {
    await assertDonor(key);
    const clean = [...new Set((Array.isArray(tags) ? tags : []).map(normalizeTag).filter(Boolean))].slice(0, 20);
    await donorRepo.replaceTags(key, clean);
    await logService.log({ userId: actor.id, action: "donor.tags_updated", meta: { count: clean.length } });
    return clean;
};

// --- Export CSV ---

// Une cellule commencant par = + - @ (ou tabulation) serait interpretee comme formule par un tableur.
function csvCell(value) {
    let text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

exports.csvCell = csvCell;

exports.exportCsv = async (actor, query) => {
    const filters = normalizeFilters(query);
    const { items } = await donorRepo.list(filters, { sort: "total" });
    const header = ["cle", "nom", "email", "region", "nombre_dons", "total_eur", "total_eur_natif", "total_xaf", "devise_principale", "premier_don", "dernier_don", "recurrent", "etiquettes"];
    const lines = items.map((d) => [
        d.donor_key, d.name, d.email, d.region, d.donations, d.total_eur.toFixed(2), d.total_eur_native.toFixed(2), d.total_xaf,
        d.main_currency, d.first_donation_at, d.last_donation_at, d.recurring ? "oui" : "non", d.tags.join(" "),
    ].map(csvCell).join(";"));
    await logService.log({
        userId: actor.id,
        action: "donor.export",
        meta: { segment: filters.segment, region: filters.region || undefined, tag: filters.tag || undefined, rows: items.length },
    });
    // BOM : accents lisibles a l'ouverture dans un tableur.
    return `${String.fromCharCode(0xfeff)}${[header.join(";"), ...lines].join("\r\n")}\r\n`;
};
