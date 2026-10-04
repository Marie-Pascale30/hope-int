const db = require("../config/db");

const FIELDS = [
    "title", "description", "location", "region", "start_at", "end_at", "capacity", "image_url", "project_id", "published",
];

const SELECT = `
  SELECT e.*, pr.title AS project_title, COUNT(r.id) AS registered_count
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

exports.remove = async (id) => {
    const [result] = await db.query("DELETE FROM events WHERE id = ?", [id]);
    return result.affectedRows;
};

// Inscription atomique : verrouille l'evenement pour ne jamais depasser la capacite.
exports.register = async (eventId, userId) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [events] = await connection.query(
            "SELECT id, capacity, start_at, published FROM events WHERE id = ? FOR UPDATE",
            [eventId]
        );
        const event = events[0];
        if (!event || !event.published) {
            await connection.rollback();
            return { error: "not_found" };
        }
        if (new Date(event.start_at) < new Date()) {
            await connection.rollback();
            return { error: "past" };
        }
        const [[existing]] = await connection.query(
            "SELECT id FROM event_registrations WHERE event_id = ? AND user_id = ?",
            [eventId, userId]
        );
        if (existing) {
            await connection.rollback();
            return { error: "already" };
        }
        if (event.capacity !== null) {
            const [[count]] = await connection.query(
                "SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ?",
                [eventId]
            );
            if (Number(count.total) >= Number(event.capacity)) {
                await connection.rollback();
                return { error: "full" };
            }
        }
        await connection.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [eventId, userId]);
        await connection.commit();
        return { ok: true };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
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
        `SELECT r.id, r.created_at, u.id AS user_id, u.name, u.email, u.phone, u.region
         FROM event_registrations r JOIN users u ON u.id = r.user_id
         WHERE r.event_id = ? ORDER BY r.created_at ASC`,
        [eventId]
    );
    return rows;
};

exports.getForUser = async (userId) => {
    const [rows] = await db.query(
        `${SELECT}
         WHERE e.id IN (SELECT event_id FROM event_registrations WHERE user_id = ?)
         GROUP BY e.id ORDER BY e.start_at DESC`,
        [userId]
    );
    return rows.map(mapEvent);
};

exports.getRegisteredEventIds = async (userId) => {
    const [rows] = await db.query("SELECT event_id FROM event_registrations WHERE user_id = ?", [userId]);
    return rows.map((row) => row.event_id);
};
