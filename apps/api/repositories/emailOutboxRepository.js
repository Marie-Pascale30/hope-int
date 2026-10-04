const db = require("../config/db");

// Pieces jointes stockees en JSON (contenu en base64).
function encodeAttachments(attachments) {
    if (!attachments?.length) return null;
    return JSON.stringify(attachments.map((item) => ({
        filename: item.filename,
        contentType: item.contentType || undefined,
        content: Buffer.isBuffer(item.content) ? item.content.toString("base64") : Buffer.from(String(item.content)).toString("base64"),
    })));
}

function decodeAttachments(value) {
    if (!value) return undefined;
    return JSON.parse(value).map((item) => ({ ...item, content: Buffer.from(item.content, "base64") }));
}

function mapRow(row) {
    if (!row) return row;
    return { ...row, sensitive: Boolean(row.is_sensitive), attachments: decodeAttachments(row.attachments) };
}

// claimId : message reserve des sa creation (envoi immediat par l'appelant, ignore par le worker).
exports.create = async ({ kind, to, subject, text, attachments, paymentId, sensitive, maxAttempts, expiresInMinutes, claimId }) => {
    const [result] = await db.query(
        `INSERT INTO email_outbox
           (kind, to_address, subject, body_text, attachments, payment_id, is_sensitive, max_attempts, expires_at,
            claimed_by, locked_until, attempts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(? > 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), NULL),
                 ?, IF(? IS NULL, NULL, DATE_ADD(NOW(), INTERVAL 120 SECOND)), ?)`,
        [
            kind || "generic",
            to,
            String(subject).slice(0, 255),
            text || "",
            encodeAttachments(attachments),
            paymentId || null,
            sensitive ? 1 : 0,
            maxAttempts || 6,
            expiresInMinutes || 0,
            expiresInMinutes || 0,
            claimId || null,
            claimId || null,
            claimId ? 1 : 0,
        ]
    );
    return result.insertId;
};

exports.findById = async (id) => {
    const [rows] = await db.query("SELECT * FROM email_outbox WHERE id = ?", [id]);
    return mapRow(rows[0]);
};

// Reservation atomique : un seul worker (ou une seule instance) obtient chaque message.
// Le verrou expire (lockSeconds) si le processus meurt en cours d'envoi.
exports.claim = async ({ claimId, limit = 10, lockSeconds = 120, id } = {}) => {
    const [result] = await db.query(
        `UPDATE email_outbox
         SET claimed_by = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? SECOND), attempts = attempts + 1
         WHERE status = 'pending' AND next_attempt_at <= NOW()
           AND (locked_until IS NULL OR locked_until < NOW())
           ${id ? "AND id = ?" : ""}
         ORDER BY id ASC
         LIMIT ?`,
        [claimId, lockSeconds, ...(id ? [id] : []), limit]
    );
    if (!result.affectedRows) return [];
    const [rows] = await db.query(
        "SELECT * FROM email_outbox WHERE claimed_by = ? AND status = 'pending' AND locked_until > NOW() ORDER BY id ASC",
        [claimId]
    );
    return rows.map(mapRow);
};

// Les contenus sensibles (mot de passe provisoire, lien de reinitialisation) sont effaces une fois traites.
const PURGE_SQL = "body_text = IF(is_sensitive = 1, '', body_text), attachments = IF(is_sensitive = 1, NULL, attachments)";

exports.markSent = async (id, claimId) => {
    const [result] = await db.query(
        `UPDATE email_outbox SET status = 'sent', sent_at = NOW(), locked_until = NULL, last_error = NULL, ${PURGE_SQL}
         WHERE id = ? AND claimed_by = ?`,
        [id, claimId]
    );
    return result.affectedRows > 0;
};

exports.markRetry = async (id, claimId, error, delaySeconds) => {
    await db.query(
        `UPDATE email_outbox SET locked_until = NULL, last_error = ?, next_attempt_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
         WHERE id = ? AND claimed_by = ?`,
        [String(error).slice(0, 500), delaySeconds, id, claimId]
    );
};

exports.markFailed = async (id, claimId, error) => {
    await db.query(
        `UPDATE email_outbox SET status = 'failed', locked_until = NULL, last_error = ?, ${PURGE_SQL}
         WHERE id = ? AND claimed_by = ?`,
        [String(error).slice(0, 500), id, claimId]
    );
};

exports.countByStatus = async () => {
    const [rows] = await db.query("SELECT status, COUNT(*) AS count FROM email_outbox GROUP BY status");
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
};
