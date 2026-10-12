// Liste d'attente des evenements complets : inscription en attente, rang, desinscription et
// promotion automatique (dans l'ordre d'arrivee) des qu'une place se libere.
const { withTransaction } = require("../config/db");
const eventRepo = require("../repositories/eventRepository");
const waitlistRepo = require("../repositories/volunteerWaitlistRepository");
const logService = require("./activityLogService");
const emailService = require("./emailService");
const { badRequest, conflict, notFound } = require("../utils/httpError");

const ORG_NAME = process.env.ORG_NAME || "HOPE International";
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3001").replace(/\/$/, "");

function formatDate(value) {
    try {
        return new Date(value).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Douala" });
    } catch (_error) {
        return String(value);
    }
}

// Promotion dans la transaction de l'appelant (evenement verrouille ici) : autant de membres que
// de places libres, dans l'ordre d'arrivee. Rien si l'evenement est depublie ou commence.
async function promoteWithin(connection, eventId) {
    const event = await waitlistRepo.lockEventForPromotion(connection, eventId);
    if (!event || !event.published || new Date(event.start_at) < new Date()) return { event, promoted: [] };
    const registered = await waitlistRepo.countRegistered(connection, eventId);
    const free = event.capacity === null ? Number.MAX_SAFE_INTEGER : Number(event.capacity) - registered;
    if (free <= 0) return { event, promoted: [] };
    const entries = await waitlistRepo.takeFirst(connection, eventId, Math.min(free, 10000));
    for (const entry of entries) await waitlistRepo.promote(connection, eventId, entry);
    return { event, promoted: entries };
}

// Email de promotion (transactionnel : il concerne une inscription demandee par le membre).
// Envoi non bloquant.
function notifyPromoted(event, promoted) {
    for (const person of promoted) {
        if (!person.email) continue;
        Promise.resolve()
            .then(() => emailService.send({
                to: person.email,
                subject: `${ORG_NAME} - Une place s'est libérée : vous êtes inscrit(e) à ${event.title}`,
                text: [
                    `Bonjour ${person.name || ""},`.trim(),
                    "",
                    `Une place s'est libérée pour l'événement « ${event.title} » prévu le ${formatDate(event.start_at)}${event.location ? ` (${event.location})` : ""}.`,
                    "Vous étiez sur la liste d'attente : votre inscription est désormais confirmée.",
                    `Détails et désinscription : ${FRONTEND_URL}/evenements/${event.id}`,
                    "",
                    `L'équipe ${ORG_NAME}`,
                ].join("\n"),
            }))
            .catch((error) => console.error("event-waitlist-email-error:", error.message));
    }
}

async function afterPromotion(eventId, { event, promoted }, actorId = null) {
    if (!promoted.length) return 0;
    notifyPromoted(event, promoted);
    await logService.log({
        userId: actorId,
        action: "event.waitlist_promote",
        meta: { eventId: Number(eventId), users: promoted.map((entry) => entry.user_id) },
    });
    return promoted.length;
}

// Promotion autonome (ex. capacite augmentee) : transaction dediee.
exports.promote = async (eventId, actorId = null) => {
    const outcome = await withTransaction((connection) => promoteWithin(connection, eventId));
    return afterPromotion(eventId, outcome, actorId);
};

exports.promoteWithin = promoteWithin;
exports.afterPromotion = afterPromotion;

// Inscription sur la liste d'attente. S'il reste une place, le membre est directement inscrit.
exports.join = async (user, eventId) => {
    const status = await withTransaction(async (connection) => {
        const event = await eventRepo.lockForRegistration(connection, eventId, user.id);
        if (!event || !event.published) throw notFound("Événement introuvable");
        if (new Date(event.start_at) < new Date()) throw badRequest("Cet événement a déjà commencé");
        if (event.alreadyRegistered) throw conflict("Vous êtes déjà inscrit(e) à cet événement");
        if (event.capacity === null || event.registered < Number(event.capacity)) {
            await eventRepo.insertRegistration(connection, eventId, user.id);
            await waitlistRepo.remove(connection, eventId, user.id);
            return "registered";
        }
        if (!(await waitlistRepo.insert(connection, eventId, user.id))) {
            throw conflict("Vous êtes déjà sur la liste d'attente de cet événement");
        }
        return "waitlisted";
    });
    const position = status === "waitlisted" ? await waitlistRepo.position(eventId, user.id) : null;
    await logService.log({
        userId: user.id,
        action: status === "waitlisted" ? "event.waitlist_join" : "event.register",
        meta: { eventId: Number(eventId), ...(position ? { position } : {}) },
    });
    return { status, position };
};

exports.leave = async (user, eventId) => {
    const removed = await withTransaction((connection) => waitlistRepo.remove(connection, eventId, user.id));
    if (!removed) throw notFound("Vous n'êtes pas sur la liste d'attente de cet événement");
    await logService.log({ userId: user.id, action: "event.waitlist_leave", meta: { eventId: Number(eventId) } });
};

exports.listForEvent = (eventId) => waitlistRepo.listForEvent(eventId);
