const { withTransaction } = require("../config/db");
const eventRepo = require("../repositories/eventRepository");
const logService = require("./activityLogService");
const emailService = require("./emailService");
const waitlist = require("./volunteerWaitlist");
const waitlistRepo = require("../repositories/volunteerWaitlistRepository");
const { badRequest, conflict, notFound } = require("../utils/httpError");
const { removeUpload, removeReplacedUpload } = require("../utils/uploads");

const ORG_NAME = process.env.ORG_NAME || "HOPE International Project";

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
    if ("image_alt" in payload) payload.image_alt = String(payload.image_alt ?? "").trim() || null;
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

// Champs dont la modification concerne les inscrits.
const NOTIFIED_FIELDS = { title: "intitulé", start_at: "date de début", end_at: "date de fin", location: "lieu" };

// Valeurs relues en base avant et apres la mise a jour (dates : objets Date).
function sameValue(field, before, after) {
    if (field === "start_at" || field === "end_at") {
        const time = (value) => (value ? new Date(value).getTime() : null);
        return time(before) === time(after);
    }
    return String(before ?? "") === String(after ?? "");
}

// Evenement a venir modifie (intitule, dates, lieu) ou depublie : les inscrits sont prevenus par
// email, sans bloquer la reponse.
function notifyChange(before, after, registrations) {
    const unpublished = before.published && !after.published;
    const changed = Object.keys(NOTIFIED_FIELDS).filter((field) => !sameValue(field, before[field], after[field]));
    if (!unpublished && !changed.length) return 0;

    const subject = unpublished
        ? `${ORG_NAME} - Événement retiré de l'agenda : ${before.title}`
        : `${ORG_NAME} - Événement modifié : ${after.title}`;
    const lines = unpublished
        ? [
            `L'événement « ${before.title} » prévu le ${formatDate(before.start_at)} a été retiré de l'agenda.`,
            "Nous reviendrons vers vous si une nouvelle date est fixée.",
        ]
        : [
            `L'événement « ${after.title} » auquel vous êtes inscrit(e) a été modifié (${changed.map((field) => NOTIFIED_FIELDS[field]).join(", ")}).`,
            `Date : ${formatDate(after.start_at)}${after.end_at ? ` - fin : ${formatDate(after.end_at)}` : ""}`,
            `Lieu : ${after.location}`,
        ];
    for (const person of registrations) {
        if (!person.email) continue;
        Promise.resolve()
            .then(() => emailService.send({
                to: person.email,
                subject,
                text: [`Bonjour ${person.name || ""},`.trim(), "", ...lines, "", `L'équipe ${ORG_NAME}`].join("\n"),
            }))
            .catch((error) => console.error("event-update-email-error:", error.message));
    }
    return registrations.length;
}

// Membre connecte : statut sur chaque evenement (inscrit, en liste d'attente avec son rang).
exports.listPublic = async ({ region, userId } = {}) => {
    const events = await eventRepo.getAll({ publishedOnly: true, upcomingOnly: true, region });
    if (!userId) return events;
    const mine = await eventRepo.getParticipation(userId);
    return events.map((event) => ({ ...event, ...eventRepo.participationFields(mine.get(event.id)) }));
};

exports.getPublic = async (id, userId) => {
    const event = await eventRepo.findById(id, { publishedOnly: true });
    if (!event) throw notFound("Événement introuvable");
    if (!userId) return event;
    const mine = await eventRepo.getParticipation(userId, [event.id]);
    return { ...event, ...eventRepo.participationFields(mine.get(event.id)) };
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
    // Nouvelle date de debut : le rappel de la veille sera renvoye pour la nouvelle date.
    if ("start_at" in payload && toSqlDateTime(existing.start_at) !== payload.start_at) {
        await eventRepo.resetReminder(id);
    }
    // Places supplementaires (capacite augmentee ou supprimee) : promotion de la liste d'attente.
    let promoted = 0;
    if ("capacity" in payload && existing.waitlist_count > 0) promoted = await waitlist.promote(id, actor.id);
    const updated = await eventRepo.findById(id);

    // Seul un evenement a venir (avant comme apres) justifie de prevenir les inscrits.
    let notified = 0;
    const upcoming = (event) => new Date(event.end_at || event.start_at) >= new Date();
    if (upcoming(existing) && existing.registered_count > 0) {
        notified = notifyChange(existing, updated, await eventRepo.getRegistrations(id));
    }
    await logService.log({
        userId: actor.id,
        action: "event.update",
        meta: { id, ...(notified ? { notified } : {}), ...(promoted ? { promoted } : {}) },
    });
    return updated;
};

exports.remove = async (actor, id) => {
    const event = await eventRepo.findById(id);
    if (!event) throw notFound("Événement introuvable");
    const registrations = await eventRepo.getRegistrations(id);
    const waiting = await waitlist.listForEvent(id);
    if (!(await eventRepo.remove(id))) throw notFound("Événement introuvable");
    if (event.image_url) await removeUpload(event.image_url);

    // Seul un evenement a venir justifie de prevenir les inscrits.
    const ended = new Date(event.end_at || event.start_at) < new Date();
    // Les personnes en liste d'attente sont prevenues elles aussi.
    if (!ended) notifyCancellation(event, [...registrations, ...waiting]);
    await logService.log({
        userId: actor.id,
        action: "event.delete",
        meta: {
            id,
            title: event.title,
            registrations: registrations.length,
            notified: ended ? 0 : registrations.length + waiting.length,
            ...(waiting.length ? { waitlist: waiting.length } : {}),
        },
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
    // Le site propose alors la liste d'attente (code EVENT_FULL).
    full: () => conflict("Cet événement est complet", { code: "EVENT_FULL" }),
};

// Inscription atomique : evenement verrouille le temps de verifier les regles (publie, pas encore
// commence, pas deja inscrit, places restantes) puis d'inserer l'inscription.
exports.register = async (user, id) => {
    await withTransaction(async (connection) => {
        const event = await eventRepo.lockForRegistration(connection, id, user.id);
        if (!event || !event.published) throw REGISTRATION_ERRORS.not_found();
        waitlist.assertAudience(user, event);
        if (new Date(event.start_at) < new Date()) throw REGISTRATION_ERRORS.past();
        if (event.alreadyRegistered) throw REGISTRATION_ERRORS.already();
        if (event.capacity !== null && event.registered >= Number(event.capacity)) throw REGISTRATION_ERRORS.full();
        await eventRepo.insertRegistration(connection, id, user.id);
        // Un membre en liste d'attente qui obtient une place la quitte.
        await waitlistRepo.remove(connection, id, user.id);
    });
    await logService.log({ userId: user.id, action: "event.register", meta: { eventId: Number(id) } });
    return eventRepo.findById(id);
};

const UNREGISTRATION_ERRORS = {
    not_found: () => notFound("Événement introuvable"),
    ended: () => badRequest("Cet événement est terminé : la désinscription n'est plus possible"),
    not_registered: () => notFound("Inscription introuvable"),
};

// Desinscription et promotion du premier de la liste d'attente dans la meme transaction
// (evenement verrouille) : la place liberee ne peut pas etre prise par une inscription concurrente.
exports.unregister = async (user, id) => {
    const outcome = await withTransaction(async (connection) => {
        const event = await waitlistRepo.lockEventForUnregister(connection, id);
        if (!event) return { error: "not_found" };
        if (event.ended) return { error: "ended" };
        if (!(await waitlistRepo.deleteRegistration(connection, id, user.id))) return { error: "not_registered" };
        return waitlist.promoteWithin(connection, id);
    });
    if (outcome.error) throw UNREGISTRATION_ERRORS[outcome.error]();
    await logService.log({ userId: user.id, action: "event.unregister", meta: { eventId: Number(id) } });
    await waitlist.afterPromotion(id, outcome);
};

exports.listForUser = async (userId) => eventRepo.getForUser(userId);
