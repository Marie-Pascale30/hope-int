// Liste d'attente des evenements complets. Les ecritures se font dans la transaction de
// l'appelant, l'evenement etant verrouille (FOR UPDATE) : inscriptions, desinscriptions et
// promotions sont ainsi serialisees par evenement.
const db = require("../config/db");

// Ajout en fin de liste ; false si le membre y figure deja.
exports.insert = async (connection, eventId, userId) => {
    const [result] = await connection.query(
        "INSERT IGNORE INTO event_waitlist (event_id, user_id) VALUES (?, ?)",
        [eventId, userId]
    );
    return result.affectedRows > 0;
};

exports.remove = async (connection, eventId, userId) => {
    const [result] = await connection.query("DELETE FROM event_waitlist WHERE event_id = ? AND user_id = ?", [eventId, userId]);
    return result.affectedRows;
};

// Rang (1 = premier) du membre dans la liste d'attente, null s'il n'y figure pas.
exports.position = async (eventId, userId, connection = db) => {
    const [[row]] = await connection.query(
        `SELECT (SELECT COUNT(*) FROM event_waitlist w2 WHERE w2.event_id = w.event_id AND w2.id <= w.id) AS position
         FROM event_waitlist w WHERE w.event_id = ? AND w.user_id = ?`,
        [eventId, userId]
    );
    return row ? Number(row.position) : null;
};

exports.countRegistered = async (connection, eventId) => {
    const [[row]] = await connection.query("SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ?", [eventId]);
    return Number(row.total);
};

// Premiers de la liste (verrouilles), avec les coordonnees utiles a l'email de promotion.
exports.takeFirst = async (connection, eventId, limit) => {
    const [rows] = await connection.query(
        `SELECT w.id, w.user_id, u.name, u.email
         FROM event_waitlist w JOIN users u ON u.id = w.user_id
         WHERE w.event_id = ? ORDER BY w.id ASC LIMIT ? FOR UPDATE`,
        [eventId, limit]
    );
    return rows;
};

// Passage de la liste d'attente aux inscrits.
exports.promote = async (connection, eventId, entry) => {
    await connection.query("INSERT IGNORE INTO event_registrations (event_id, user_id) VALUES (?, ?)", [eventId, entry.user_id]);
    await connection.query("DELETE FROM event_waitlist WHERE id = ?", [entry.id]);
};

// Liste d'attente nominative d'un evenement (administration).
exports.listForEvent = async (eventId) => {
    const [rows] = await db.query(
        `SELECT w.id, w.created_at, u.id AS user_id, u.name, u.email, u.phone, u.region
         FROM event_waitlist w JOIN users u ON u.id = w.user_id
         WHERE w.event_id = ? ORDER BY w.id ASC`,
        [eventId]
    );
    return rows.map((row, index) => ({ ...row, position: index + 1 }));
};

// Desinscription dans la transaction : evenement verrouille, inscription supprimee.
exports.lockEventForUnregister = async (connection, eventId) => {
    const [[event]] = await connection.query(
        "SELECT id, COALESCE(end_at, start_at) < NOW() AS ended FROM events WHERE id = ? FOR UPDATE",
        [eventId]
    );
    return event ? { id: event.id, ended: Boolean(Number(event.ended)) } : null;
};

exports.deleteRegistration = async (connection, eventId, userId) => {
    const [result] = await connection.query(
        "DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?",
        [eventId, userId]
    );
    return result.affectedRows;
};

// Evenement verrouille pour une promotion : regles de publication, date et capacite.
exports.lockEventForPromotion = async (connection, eventId) => {
    const [[event]] = await connection.query(
        "SELECT id, title, start_at, end_at, location, capacity, published FROM events WHERE id = ? FOR UPDATE",
        [eventId]
    );
    return event || null;
};
