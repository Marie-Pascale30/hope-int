const db = require("../config/db");

const FIELDS = [
    "title", "description", "location", "region", "start_at", "end_at", "capacity", "image_url", "image_alt", "project_id", "published",
];

const SELECT = `
  SELECT e.*, pr.title AS project_title, COUNT(r.id) AS registered_count,
         (SELECT COUNT(*) FROM event_waitlist w WHERE w.event_id = e.id) AS waitlist_count
  FROM events e
  LEFT JOIN projects pr ON pr.id = e.project_id
  LEFT JOIN event_registrations r ON r.event_id = e.id`;

// Un champ absent ou undefined n'est jamais ecrit (evite d'ecraser une valeur par NULL).
const presentFields = (payload) =>
    FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== undefined);

function mapEvent(row) {
    if (!row) return row;
    const registered = Number(row.registered_count || 0);
    return {
        ...row,
        published: Boolean(row.published),
        registered_count: registered,
        waitlist_count: Number(row.waitlist_count || 0),
        remaining_spots: row.capacity === null ? null : Math.max(0, Number(row.capacity) - registered),
    };
}

exports.getAll = async ({ publishedOnly = false, upcomingOnly = false, region } = {}) => {
    const clauses = [];
    const params = [];
    if (publishedOnly) clauses.push("e.published = 1");
    if (upcomingOnly) clauses.push("COALESCE(e.end_at, e.start_at) >= NOW()");
    if (region) {
        clauses.push("e.region = ?");
        params.push(region);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const order = upcomingOnly ? "ASC" : "DESC";
    const [rows] = await db.query(`${SELECT} ${where} GROUP BY e.id ORDER BY e.start_at ${order}`, params);
    return rows.map(mapEvent);
};

exports.findById = async (id, { publishedOnly = false } = {}) => {
    const where = `WHERE e.id = ?${publishedOnly ? " AND e.published = 1" : ""}`;
    const [rows] = await db.query(`${SELECT} ${where} GROUP BY e.id`, [id]);
    return mapEvent(rows[0]);
};

exports.create = async (payload, createdBy) => {
    const present = presentFields(payload);
    const [result] = await db.query(
        `INSERT INTO events (${[...present, "created_by"].join(", ")}) VALUES (${[...present, "created_by"].map(() => "?").join(", ")})`,
        [...present.map((field) => payload[field]), createdBy]
    );
    return result.insertId;
};

exports.update = async (id, payload) => {
    const present = presentFields(payload);
    if (!present.length) return;
    await db.query(
        `UPDATE events SET ${present.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
        [...present.map((field) => payload[field]), id]
    );
};

// Rappel de la veille a renvoyer (date de debut modifiee).
exports.resetReminder = async (id) => {
    await db.query("UPDATE events SET reminder_sent_at = NULL WHERE id = ?", [id]);
};

exports.remove = async (id) => {
    const [result] = await db.query("DELETE FROM events WHERE id = ?", [id]);
    return result.affectedRows;
};

// Inscription : l'evenement est verrouille (FOR UPDATE) dans la transaction de l'appelant, avec
// les compteurs utiles aux regles metier (appliquees par eventService). null si introuvable.
exports.lockForRegistration = async (connection, eventId, userId) => {
    const [[event]] = await connection.query(
        "SELECT id, capacity, start_at, published FROM events WHERE id = ? FOR UPDATE",
        [eventId]
    );
    if (!event) return null;
    const [[counts]] = await connection.query(
        `SELECT COUNT(*) AS registered, COALESCE(SUM(user_id = ?), 0) AS mine
         FROM event_registrations WHERE event_id = ?`,
        [userId, eventId]
    );
    return {
        ...event,
        published: Boolean(event.published),
        registered: Number(counts.registered),
        alreadyRegistered: Number(counts.mine) > 0,
    };
};

exports.insertRegistration = async (connection, eventId, userId) => {
    await connection.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [eventId, userId]);
};

// Desinscription impossible une fois l'evenement termine (la presence fait foi).
exports.unregister = async (eventId, userId) => {
    const [[event]] = await db.query(
        "SELECT id, COALESCE(end_at, start_at) < NOW() AS ended FROM events WHERE id = ?",
        [eventId]
    );
    if (!event) return { error: "not_found" };
    if (Number(event.ended)) return { error: "ended" };
    const [result] = await db.query(
        "DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?",
        [eventId, userId]
    );
    return result.affectedRows ? { ok: true } : { error: "not_registered" };
};

exports.getRegistrations = async (eventId) => {
    const [rows] = await db.query(
        `SELECT r.id, r.created_at, r.attendance, r.hours, r.attendance_at,
                u.id AS user_id, u.name, u.email, u.phone, u.region
         FROM event_registrations r JOIN users u ON u.id = r.user_id
         WHERE r.event_id = ? ORDER BY r.created_at ASC`,
        [eventId]
    );
    return rows;
};

// Evenements du membre : inscriptions (avec presence et heures) et listes d'attente (avec rang).
exports.getForUser = async (userId) => {
    const [rows] = await db.query(
        `${SELECT}
         WHERE e.id IN (SELECT event_id FROM event_registrations WHERE user_id = ?)
            OR e.id IN (SELECT event_id FROM event_waitlist WHERE user_id = ?)
         GROUP BY e.id ORDER BY e.start_at DESC`,
        [userId, userId]
    );
    const participation = await exports.getParticipation(userId);
    return rows.map(mapEvent).map((event) => ({ ...event, ...participationFields(participation.get(event.id)) }));
};

// Statut du membre par evenement : Map eventId -> { status, position?, attendance?, hours? }.
exports.getParticipation = async (userId, eventIds = null) => {
    const filter = eventIds ? " AND event_id IN (?)" : "";
    const ids = eventIds && eventIds.length ? eventIds : [0];
    const [registered] = await db.query(
        `SELECT event_id, attendance, hours FROM event_registrations WHERE user_id = ?${filter}`,
        eventIds ? [userId, ids] : [userId]
    );
    const [waiting] = await db.query(
        `SELECT w.event_id,
                (SELECT COUNT(*) FROM event_waitlist w2 WHERE w2.event_id = w.event_id AND w2.id <= w.id) AS position
         FROM event_waitlist w WHERE w.user_id = ?${eventIds ? " AND w.event_id IN (?)" : ""}`,
        eventIds ? [userId, ids] : [userId]
    );
    const map = new Map();
    waiting.forEach((row) => map.set(row.event_id, { status: "waitlisted", position: Number(row.position) }));
    registered.forEach((row) => map.set(row.event_id, {
        status: "registered",
        attendance: row.attendance || null,
        hours: row.hours === null ? null : Number(row.hours),
    }));
    return map;
};

// Champs ajoutes a un evenement pour le membre connecte.
function participationFields(entry) {
    return {
        is_registered: entry?.status === "registered",
        my_status: entry?.status || null,
        waitlist_position: entry?.status === "waitlisted" ? entry.position : null,
        ...(entry?.status === "registered" ? { my_attendance: entry.attendance, my_hours: entry.hours } : {}),
    };
}
exports.participationFields = participationFields;

exports.getRegisteredEventIds = async (userId) => {
    const [rows] = await db.query("SELECT event_id FROM event_registrations WHERE user_id = ?", [userId]);
    return rows.map((row) => row.event_id);
};
