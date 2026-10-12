// Appel des participants d'un evenement : presence et heures sur event_registrations.
const db = require("../config/db");

// Evenement verrouille (FOR UPDATE) le temps d'enregistrer l'appel.
exports.lockEvent = async (connection, eventId) => {
    const [[event]] = await connection.query(
        "SELECT id, title, start_at, end_at FROM events WHERE id = ? FOR UPDATE",
        [eventId]
    );
    return event || null;
};

// Inscriptions de l'evenement (identifiants des membres inscrits).
exports.getRegisteredUserIds = async (connection, eventId) => {
    const [rows] = await connection.query("SELECT user_id FROM event_registrations WHERE event_id = ?", [eventId]);
    return new Set(rows.map((row) => Number(row.user_id)));
};

exports.setAttendance = async (connection, { eventId, userId, attendance, hours, actorId }) => {
    await connection.query(
        `UPDATE event_registrations
         SET attendance = ?, hours = ?, attendance_by = ?, attendance_at = NOW()
         WHERE event_id = ? AND user_id = ?`,
        [attendance, hours, actorId, eventId, userId]
    );
};
