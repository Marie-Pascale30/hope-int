// Rappel envoye la veille aux inscrits d'un evenement, une seule fois par evenement
// (events.reminder_sent_at, reserve atomiquement avant l'envoi). Email non transactionnel :
// envoye seulement avec le consentement "event_reminders" (services/preferences.js) et un lien
// de desinscription.
const db = require("../config/db");
const eventRepo = require("../repositories/eventRepository");
const logService = require("./activityLogService");
const emailService = require("./emailService");
const preferences = require("./preferences");

const ORG_NAME = process.env.ORG_NAME || "HOPE International Project";
const FRONTEND_URL = () => (process.env.FRONTEND_URL || "http://localhost:3001").replace(/\/$/, "");

// Delai avant le debut a partir duquel le rappel part (defaut 24 h : la veille).
const leadHours = () => {
    const value = Number(process.env.EVENT_REMINDER_LEAD_HOURS);
    return Number.isFinite(value) && value > 0 && value <= 168 ? value : 24;
};

function formatDate(value) {
    try {
        return new Date(value).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Douala" });
    } catch (_error) {
        return String(value);
    }
}

async function dueEvents(now, hours) {
    const [rows] = await db.query(
        `SELECT id, title, start_at, end_at, location FROM events
         WHERE published = 1 AND reminder_sent_at IS NULL AND start_at > ? AND start_at <= ?
         ORDER BY start_at ASC LIMIT 100`,
        [now, new Date(now.getTime() + hours * 3600 * 1000)]
    );
    return rows;
}

// Reservation atomique : une seule instance (ou un seul passage) envoie le rappel.
async function claim(eventId) {
    const [result] = await db.query(
        "UPDATE events SET reminder_sent_at = NOW() WHERE id = ? AND reminder_sent_at IS NULL",
        [eventId]
    );
    return result.affectedRows === 1;
}

async function remind(event) {
    const registrations = await eventRepo.getRegistrations(event.id);
    let sent = 0;
    let skipped = 0;
    for (const person of registrations) {
        if (!person.email) continue;
        try {
            if (!(await preferences.canContact(person.email, "event_reminders"))) {
                skipped += 1;
                continue;
            }
            const footer = await preferences.unsubscribeFooter(person.email, "event_reminders");
            await emailService.send({
                to: person.email,
                subject: `${ORG_NAME} - Rappel : ${event.title} demain`,
                text: [
                    `Bonjour ${person.name || ""},`.trim(),
                    "",
                    `Nous vous rappelons l'événement « ${event.title} » auquel vous êtes inscrit(e) :`,
                    `Date : ${formatDate(event.start_at)}${event.end_at ? ` - fin : ${formatDate(event.end_at)}` : ""}`,
                    ...(event.location ? [`Lieu : ${event.location}`] : []),
                    "",
                    `Un empêchement ? Libérez votre place pour la personne suivante : ${FRONTEND_URL()}/evenements/${event.id}`,
                    "",
                    `L'équipe ${ORG_NAME}`,
                    ...(footer ? ["", footer] : []),
                ].join("\n"),
            });
            sent += 1;
        } catch (error) {
            console.error("event-reminder-email-error:", error.message);
        }
    }
    await logService.log({ userId: null, action: "event.reminder", meta: { eventId: event.id, sent, skipped } });
    return { sent, skipped };
}

// Un passage du worker (appele directement par les tests).
exports.sendDueReminders = async ({ now = new Date(), hours = leadHours() } = {}) => {
    const summary = { events: 0, sent: 0, skipped: 0 };
    for (const event of await dueEvents(now, hours)) {
        if (!(await claim(event.id))) continue;
        const result = await remind(event);
        summary.events += 1;
        summary.sent += result.sent;
        summary.skipped += result.skipped;
    }
    return summary;
};
