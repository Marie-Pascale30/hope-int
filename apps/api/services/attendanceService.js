// Appel des participants d'un evenement commence ou passe : presence / absence et heures de
// benevolat (par defaut la duree de l'evenement).
const { withTransaction } = require("../config/db");
const eventRepo = require("../repositories/eventRepository");
const attendanceRepo = require("../repositories/attendanceRepository");
const waitlistRepo = require("../repositories/volunteerWaitlistRepository");
const logService = require("./activityLogService");
const { badRequest, notFound } = require("../utils/httpError");
const { HOURS_LIMITS, eventDurationHours, roundHours } = require("@hope/shared/volunteering");

const hasStarted = (event) => new Date(event.start_at).getTime() <= Date.now();

// Feuille d'appel : inscrits (presence, heures), liste d'attente et duree par defaut.
// Liste nominative : consultation journalisee.
exports.getSheet = async (actor, eventId, { log = true } = {}) => {
    const event = await eventRepo.findById(eventId);
    if (!event) throw notFound("Événement introuvable");
    const [registrations, waitlist] = await Promise.all([
        eventRepo.getRegistrations(eventId),
        waitlistRepo.listForEvent(eventId),
    ]);
    if (log) {
        await logService.log({
            userId: actor.id,
            action: "event.view_attendance",
            meta: { eventId: Number(eventId), count: registrations.length },
        });
    }
    const rows = registrations.map((row) => ({ ...row, hours: row.hours === null ? null : Number(row.hours) }));
    return {
        event: {
            id: event.id,
            title: event.title,
            start_at: event.start_at,
            end_at: event.end_at,
            location: event.location,
            capacity: event.capacity,
        },
        default_hours: eventDurationHours(event.start_at, event.end_at),
        can_record: hasStarted(event),
        summary: {
            registered: rows.length,
            present: rows.filter((row) => row.attendance === "present").length,
            absent: rows.filter((row) => row.attendance === "absent").length,
            hours: Math.round(rows.reduce((sum, row) => sum + (row.attendance === "present" ? Number(row.hours) || 0 : 0), 0) * 100) / 100,
        },
        registrations: rows,
        waitlist,
    };
};

// entries : [{ userId, attendance: "present" | "absent" | null, hours? }].
// null efface l'appel du participant. Heures : celles saisies, sinon la duree de l'evenement.
exports.record = async (actor, eventId, entries) => {
    const counts = await withTransaction(async (connection) => {
        const event = await attendanceRepo.lockEvent(connection, eventId);
        if (!event) throw notFound("Événement introuvable");
        if (!hasStarted(event)) throw badRequest("L'appel n'est possible qu'une fois l'événement commencé");
        const registered = await attendanceRepo.getRegisteredUserIds(connection, eventId);
        const defaultHours = eventDurationHours(event.start_at, event.end_at);
        const result = { present: 0, absent: 0, cleared: 0 };
        for (const entry of entries) {
            const userId = Number(entry.userId);
            if (!registered.has(userId)) throw badRequest("Participant non inscrit à cet événement");
            const attendance = entry.attendance || null;
            let hours = null;
            if (attendance === "present") {
                const given = entry.hours === undefined || entry.hours === null || entry.hours === "" ? defaultHours : roundHours(entry.hours);
                if (!(given > 0) || given > HOURS_LIMITS.eventMax) throw badRequest("Nombre d'heures invalide");
                hours = given;
            }
            await attendanceRepo.setAttendance(connection, { eventId, userId, attendance, hours, actorId: actor.id });
            result[attendance || "cleared"] += 1;
        }
        return result;
    });
    await logService.log({ userId: actor.id, action: "event.attendance", meta: { eventId: Number(eventId), ...counts } });
    return exports.getSheet(actor, eventId, { log: false });
};
