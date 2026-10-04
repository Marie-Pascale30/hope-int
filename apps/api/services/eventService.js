const eventRepo = require("../repositories/eventRepository");
const logService = require("./activityLogService");
const emailService = require("./emailService");
const { badRequest, conflict, notFound } = require("../utils/httpError");
const { removeUpload, removeReplacedUpload } = require("../utils/uploads");

const ORG_NAME = process.env.ORG_NAME || "HOPE International";

// ISO 8601 (UTC) -> DATETIME MySQL.
function toSqlDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw badRequest("Date invalide");
    return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizePayload(body, file) {
    const payload = { ...body };
    delete payload.image;
    // L'image ne vient que d'un fichier envoye (jamais d'une URL fournie par le client).
    delete payload.image_url;
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    if ("start_at" in payload) payload.start_at = toSqlDateTime(payload.start_at);
    if ("end_at" in payload) payload.end_at = toSqlDateTime(payload.end_at);
    if ("capacity" in payload) payload.capacity = payload.capacity === "" || payload.capacity === null ? null : parseInt(payload.capacity, 10);
    if ("project_id" in payload) payload.project_id = payload.project_id ? parseInt(payload.project_id, 10) : null;
    if ("region" in payload) payload.region = payload.region || null;
    if ("published" in payload) payload.published = ["1", "true", "on", true, 1].includes(payload.published) ? 1 : 0;
    if (file) payload.image_url = `/uploads/${file.filename}`;
    if (payload.remove_image === "1" || payload.remove_image === true) payload.image_url = null;
    delete payload.remove_image;
    return payload;
}

// Dates comparees apres fusion avec l'existant : une mise a jour ne portant que end_at
// (ou start_at) est verifiee par rapport a l'autre date deja enregistree.
function assertDateOrder(payload, existing = {}) {
    const startAt = "start_at" in payload ? payload.start_at : toSqlDateTime(existing.start_at);
    const endAt = "end_at" in payload ? payload.end_at : toSqlDateTime(existing.end_at);
    if (startAt && endAt && endAt < startAt) {
        throw badRequest("La date de fin doit être après la date de début");
    }
}

function formatDate(value) {
    try {
        return new Date(value).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Douala" });
    } catch (_error) {
        return String(value);
    }
}

// Information des inscrits : envoi non bloquant (la suppression ne depend pas du SMTP).
function notifyCancellation(event, registrations) {
    for (const person of registrations) {
        if (!person.email) continue;
        Promise.resolve()
            .then(() => emailService.send({
                to: person.email,
                subject: `${ORG_NAME} - Événement annulé : ${event.title}`,
                text: [
                    `Bonjour ${person.name || ""},`.trim(),
                    "",
                    `L'événement « ${event.title} » prévu le ${formatDate(event.start_at)} (${event.location}) est annulé.`,
                    "Votre inscription est donc supprimée. Nous vous prions de nous excuser pour ce changement.",
                    "",
                    `L'équipe ${ORG_NAME}`,
                ].join("\n"),
            }))
            .catch((error) => console.error("event-cancel-email-error:", error.message));
    }
}

exports.listPublic = async ({ region, userId } = {}) => {
    const events = await eventRepo.getAll({ publishedOnly: true, upcomingOnly: true, region });
    if (!userId) return events;
    const mine = new Set(await eventRepo.getRegisteredEventIds(userId));
    return events.map((event) => ({ ...event, is_registered: mine.has(event.id) }));
};

exports.getPublic = async (id, userId) => {
    const event = await eventRepo.findById(id, { publishedOnly: true });
    if (!event) throw notFound("Événement introuvable");
    if (!userId) return event;
    const mine = await eventRepo.getRegisteredEventIds(userId);
    return { ...event, is_registered: mine.includes(event.id) };
};

exports.listAdmin = async (filters) => eventRepo.getAll(filters);

exports.create = async (actor, body, file) => {
    const payload = normalizePayload(body, file);
    if (!payload.start_at) throw badRequest("La date de début est obligatoire");
    assertDateOrder(payload);
    const id = await eventRepo.create(payload, actor.id);
    await logService.log({ userId: actor.id, action: "event.create", meta: { id } });
    return eventRepo.findById(id);
};

exports.update = async (actor, id, body, file) => {
    const existing = await eventRepo.findById(id);
    if (!existing) throw notFound("Événement introuvable");
    const payload = normalizePayload(body, file);
    if ("start_at" in payload && !payload.start_at) throw badRequest("La date de début est obligatoire");
    assertDateOrder(payload, existing);
    if (payload.capacity !== undefined && payload.capacity !== null && payload.capacity < existing.registered_count) {
        throw badRequest(`La capacité ne peut pas être inférieure au nombre d'inscrits (${existing.registered_count})`);
    }
    await eventRepo.update(id, payload);
    if ("image_url" in payload) await removeReplacedUpload(existing.image_url, payload.image_url);
    await logService.log({ userId: actor.id, action: "event.update", meta: { id } });
    return eventRepo.findById(id);
};

exports.remove = async (actor, id) => {
    const event = await eventRepo.findById(id);
    if (!event) throw notFound("Événement introuvable");
    const registrations = await eventRepo.getRegistrations(id);
    if (!(await eventRepo.remove(id))) throw notFound("Événement introuvable");
    if (event.image_url) await removeUpload(event.image_url);

    // Seul un evenement a venir justifie de prevenir les inscrits.
    const ended = new Date(event.end_at || event.start_at) < new Date();
    if (!ended) notifyCancellation(event, registrations);
    await logService.log({
        userId: actor.id,
        action: "event.delete",
        meta: { id, title: event.title, registrations: registrations.length, notified: ended ? 0 : registrations.length },
    });
};

// Liste nominative (coordonnees personnelles) : consultation journalisee.
exports.getRegistrations = async (actor, id) => {
    if (!(await eventRepo.findById(id))) throw notFound("Événement introuvable");
    const rows = await eventRepo.getRegistrations(id);
    await logService.log({ userId: actor.id, action: "event.view_registrations", meta: { eventId: Number(id), count: rows.length } });
    return rows;
};

const REGISTRATION_ERRORS = {
    not_found: () => notFound("Événement introuvable"),
    past: () => badRequest("Cet événement a déjà commencé"),
    already: () => conflict("Vous êtes déjà inscrit(e) à cet événement"),
    full: () => conflict("Cet événement est complet"),
};

exports.register = async (user, id) => {
    const result = await eventRepo.register(id, user.id);
    if (result.error) throw REGISTRATION_ERRORS[result.error]();
    await logService.log({ userId: user.id, action: "event.register", meta: { eventId: Number(id) } });
    return eventRepo.findById(id);
};

const UNREGISTRATION_ERRORS = {
    not_found: () => notFound("Événement introuvable"),
    ended: () => badRequest("Cet événement est terminé : la désinscription n'est plus possible"),
    not_registered: () => notFound("Inscription introuvable"),
};

exports.unregister = async (user, id) => {
    const result = await eventRepo.unregister(id, user.id);
    if (result.error) throw UNREGISTRATION_ERRORS[result.error]();
    await logService.log({ userId: user.id, action: "event.unregister", meta: { eventId: Number(id) } });
};

exports.listForUser = async (userId) => eventRepo.getForUser(userId);
