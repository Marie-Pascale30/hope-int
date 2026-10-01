const eventRepo = require("../repositories/eventRepository");
const logService = require("./activityLogService");
const { badRequest, conflict, notFound } = require("../utils/httpError");

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
    if ("start_at" in payload) payload.start_at = toSqlDateTime(payload.start_at);
    if ("end_at" in payload) payload.end_at = toSqlDateTime(payload.end_at);
    if ("capacity" in payload) payload.capacity = payload.capacity === "" || payload.capacity === null ? null : parseInt(payload.capacity, 10);
    if ("project_id" in payload) payload.project_id = payload.project_id ? parseInt(payload.project_id, 10) : null;
    if ("region" in payload) payload.region = payload.region || null;
    if ("published" in payload) payload.published = ["1", "true", "on", true, 1].includes(payload.published) ? 1 : 0;
    if (file) payload.image_url = `/uploads/${file.filename}`;
    if (payload.remove_image === "1") payload.image_url = null;
    delete payload.remove_image;

    if (payload.start_at && payload.end_at && payload.end_at < payload.start_at) {
        throw badRequest("La date de fin doit être après la date de début");
    }
    return payload;
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
    const id = await eventRepo.create(payload, actor.id);
    await logService.log({ userId: actor.id, action: "event.create", meta: { id } });
    return eventRepo.findById(id);
};

exports.update = async (actor, id, body, file) => {
    const existing = await eventRepo.findById(id);
    if (!existing) throw notFound("Événement introuvable");
    const payload = normalizePayload(body, file);
    if (payload.capacity !== undefined && payload.capacity !== null && payload.capacity < existing.registered_count) {
        throw badRequest(`La capacité ne peut pas être inférieure au nombre d'inscrits (${existing.registered_count})`);
    }
    await eventRepo.update(id, payload);
    await logService.log({ userId: actor.id, action: "event.update", meta: { id } });
    return eventRepo.findById(id);
};

exports.remove = async (actor, id) => {
    if (!(await eventRepo.remove(id))) throw notFound("Événement introuvable");
    await logService.log({ userId: actor.id, action: "event.delete", meta: { id } });
};

exports.getRegistrations = async (id) => {
    if (!(await eventRepo.findById(id))) throw notFound("Événement introuvable");
    return eventRepo.getRegistrations(id);
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

exports.unregister = async (user, id) => {
    if (!(await eventRepo.unregister(id, user.id))) throw notFound("Inscription introuvable");
    await logService.log({ userId: user.id, action: "event.unregister", meta: { eventId: Number(id) } });
};

exports.listForUser = async (userId) => eventRepo.getForUser(userId);
