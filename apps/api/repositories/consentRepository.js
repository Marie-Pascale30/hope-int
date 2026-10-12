const db = require("../config/db");

// Historique des consentements : chaque accord ou retrait est une nouvelle ligne (jamais
// modifiee), l'etat courant d'un sujet est la derniere ligne pour cette personne.
// Une personne est reconnue par son email et/ou son compte (user_id).

exports.record = async ({ userId = null, email = null, topic, granted, source, textVersion = null, ref = null }, connection = db) => {
    await connection.query(
        `INSERT INTO consents (user_id, email, topic, granted, source, text_version, ref)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, email ? String(email).trim().toLowerCase() : null, topic, granted ? 1 : 0, source, textVersion, ref]
    );
};

// Derniere decision par sujet pour un email et/ou un compte : { topic: { granted, created_at, source } }.
exports.latestFor = async ({ email, userId }) => {
    const clauses = [];
    const params = [];
    if (email) { clauses.push("email = ?"); params.push(String(email).trim().toLowerCase()); }
    if (userId) { clauses.push("user_id = ?"); params.push(Number(userId)); }
    if (!clauses.length) return {};
    const [rows] = await db.query(
        `SELECT topic, granted, source, text_version, created_at, id FROM consents
         WHERE ${clauses.join(" OR ")} ORDER BY id DESC`,
        params
    );
    const latest = {};
    for (const row of rows) {
        if (!latest[row.topic]) {
            latest[row.topic] = { granted: Boolean(row.granted), source: row.source, textVersion: row.text_version, at: row.created_at };
        }
    }
    return latest;
};

// Historique complet (export RGPD).
exports.historyFor = async ({ email, userId }) => {
    const [rows] = await db.query(
        `SELECT topic, granted, source, text_version, created_at FROM consents
         WHERE (email = ? AND ? IS NOT NULL) OR (user_id = ? AND ? IS NOT NULL)
         ORDER BY id ASC`,
        [email ? String(email).toLowerCase() : null, email || null, userId || null, userId || null]
    );
    return rows.map((row) => ({ ...row, granted: Boolean(row.granted) }));
};

// Emails dont la derniere decision sur le sujet est un accord (abonnes newsletter...).
exports.grantedEmails = async (topic) => {
    const [rows] = await db.query(
        `SELECT c.email AS email, COALESCE(u.name, ue.name) AS name
         FROM consents c
         JOIN (SELECT MAX(id) AS id FROM consents WHERE topic = ? AND email IS NOT NULL GROUP BY email) last ON last.id = c.id
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN users ue ON ue.email = c.email
         WHERE c.granted = 1 AND (u.id IS NULL OR u.anonymized_at IS NULL)
         ORDER BY c.email`,
        [topic]
    );
    return rows;
};

exports.countWithdrawnByRef = async (ref) => {
    const [[row]] = await db.query("SELECT COUNT(*) AS total FROM consents WHERE ref = ? AND granted = 0", [ref]);
    return Number(row.total);
};

exports.removeFor = async ({ email, userId }, connection = db) => {
    await connection.query("DELETE FROM consents WHERE (email = ? AND ? IS NOT NULL) OR (user_id = ? AND ? IS NOT NULL)", [
        email ? String(email).toLowerCase() : null, email || null, userId || null, userId || null,
    ]);
};
