const db = require("../config/db");

// Lectures et anonymisations pour les droits RGPD (export, effacement) et les durees de
// conservation. Requetes propres au module (les depots des autres domaines ne sont pas modifies).

const lower = (email) => String(email || "").trim().toLowerCase();

// --- Export ---

exports.profile = async (userId) => {
    const [rows] = await db.query(
        `SELECT id, name, email, phone, region, skills, availability, roles, status, created_at, last_login_at
         FROM users WHERE id = ?`,
        [userId]
    );
    return rows[0] || null;
};

exports.donations = async ({ userId, email }) => {
    const [rows] = await db.query(
        `SELECT p.id, p.amount, p.currency, p.method, p.provider, p.status, p.frequency, p.donor_name, p.donor_email,
                p.project_id, pr.title AS project_title, p.receipt_number, p.refunded_amount, p.paid_at, p.created_at
         FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id
         WHERE p.user_id = ? OR (p.donor_email IS NOT NULL AND LOWER(p.donor_email) = ?)
         ORDER BY p.created_at ASC, p.id ASC`,
        [userId, lower(email)]
    );
    return rows;
};

exports.eventRegistrations = async (userId) => {
    const [rows] = await db.query(
        `SELECT r.event_id, e.title, e.start_at, e.location, r.created_at
         FROM event_registrations r JOIN events e ON e.id = r.event_id
         WHERE r.user_id = ? ORDER BY r.created_at ASC`,
        [userId]
    );
    return rows;
};

exports.applications = async ({ userId, email }) => {
    const [rows] = await db.query(
        `SELECT id, name, email, phone, region, interests, motivation, status, created_at, updated_at
         FROM applications WHERE user_id = ? OR LOWER(email) = ? ORDER BY created_at ASC`,
        [userId, lower(email)]
    );
    return rows;
};

exports.messages = async (email) => {
    const [rows] = await db.query(
        "SELECT id, name, email, subject, content, message_type, created_at FROM messages WHERE LOWER(email) = ? ORDER BY created_at ASC",
        [lower(email)]
    );
    return rows;
};

// --- Effacement (dans une transaction : connection) ---

// Paiements de la personne : les champs courants sont vides, les champs receipt_* (recu fige)
// sont conserves pour l'obligation comptable. Renvoie les identifiants des dons avec recu.
exports.anonymizePayments = async (connection, { userId, email }) => {
    const [rows] = await connection.query(
        "SELECT id, receipt_number FROM payments WHERE user_id = ? OR (donor_email IS NOT NULL AND LOWER(donor_email) = ?)",
        [userId, lower(email)]
    );
    if (!rows.length) return { count: 0, receiptIds: [] };
    const ids = rows.map((row) => row.id);
    await connection.query(
        `UPDATE payments SET donor_name = NULL, donor_email = NULL, user_id = NULL WHERE id IN (${ids.map(() => "?").join(", ")})`,
        ids
    );
    return { count: ids.length, receiptIds: rows.filter((row) => row.receipt_number).map((row) => row.id) };
};

exports.retainReceipts = async (connection, paymentIds, years) => {
    for (const id of paymentIds) {
        await connection.query(
            `INSERT INTO privacy_retained_receipts (payment_id, purge_after) VALUES (?, DATE_ADD(CURDATE(), INTERVAL ? YEAR))
             ON DUPLICATE KEY UPDATE purge_after = GREATEST(purge_after, VALUES(purge_after))`,
            [id, years]
        );
    }
};

exports.anonymizeUser = async (connection, userId, { placeholderEmail, passwordHash }) => {
    await connection.query(
        `UPDATE users SET name = 'Compte supprimé', email = ?, password = ?, phone = NULL, region = NULL, skills = NULL,
                availability = NULL, status = 'inactive', role = 'membre', roles = '["membre"]',
                token_version = token_version + 1, anonymized_at = NOW()
         WHERE id = ?`,
        [placeholderEmail, passwordHash, userId]
    );
};

exports.eraseRelated = async (connection, { userId, email, placeholderEmail }) => {
    const address = lower(email);
    const counts = {};
    const run = async (key, sql, params) => {
        const [result] = await connection.query(sql, params);
        counts[key] = result.affectedRows;
    };
    await run("eventRegistrations", "DELETE FROM event_registrations WHERE user_id = ?", [userId]);
    await run("applications",
        `UPDATE applications SET name = 'Anonyme', email = ?, phone = NULL, motivation = '[supprimé]', review_note = NULL
         WHERE user_id = ? OR LOWER(email) = ?`,
        [placeholderEmail, userId, address]);
    await run("messages",
        "UPDATE messages SET name = 'Anonyme', email = ?, content = '[supprimé]', notes = NULL WHERE LOWER(email) = ?",
        [placeholderEmail, address]);
    await run("consents", "DELETE FROM consents WHERE user_id = ? OR email = ?", [userId, address]);
    await run("passwordResets", "DELETE FROM password_resets WHERE user_id = ?", [userId]);
    await run("emailsPending", "DELETE FROM email_outbox WHERE LOWER(to_address) = ? AND status IN ('pending', 'retry')", [address]);
    await run("emailsSent",
        "UPDATE email_outbox SET to_address = ?, body_text = '', attachments = NULL WHERE LOWER(to_address) = ?",
        [placeholderEmail, address]);
    await run("campaignRecipients", "UPDATE campaign_recipients SET email = CONCAT('deleted-', id, '@deleted.invalid') WHERE email = ?", [address]);
    await run("donorNotes", "DELETE FROM donor_notes WHERE donor_key IN (?, ?)", [`u:${userId}`, `e:${address}`]);
    await run("donorTags", "DELETE FROM donor_tags WHERE donor_key IN (?, ?)", [`u:${userId}`, `e:${address}`]);
    await run("authAttempts", "DELETE FROM auth_attempts WHERE identifier = ?", [address]);
    // Journaux : l'adresse est retiree des details (le lien vers le compte, anonymise, est conserve).
    await run("logs",
        `UPDATE activity_logs SET meta = CAST(REPLACE(CAST(meta AS CHAR), ?, '[supprimé]') AS JSON)
         WHERE meta IS NOT NULL AND LOWER(CAST(meta AS CHAR)) LIKE ?`,
        [email, `%${address.replace(/[\\%_]/g, (char) => `\\${char}`)}%`]);
    return counts;
};

// --- Durees de conservation ---

exports.purgeOutbox = async (days) => {
    const [result] = await db.query(
        `UPDATE email_outbox SET body_text = '', attachments = NULL
         WHERE status IN ('sent', 'failed') AND COALESCE(sent_at, updated_at) < DATE_SUB(NOW(), INTERVAL ? DAY)
           AND (attachments IS NOT NULL OR body_text <> '')
         LIMIT 5000`,
        [days]
    );
    return result.affectedRows;
};

exports.logsToAnonymize = async (months, limit = 500) => {
    const [rows] = await db.query(
        `SELECT id, meta FROM activity_logs
         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH) AND meta IS NOT NULL
           AND JSON_EXTRACT(meta, '$._anonymized') IS NULL
         ORDER BY id ASC LIMIT ?`,
        [months, limit]
    );
    return rows;
};

exports.updateLogMeta = async (id, meta) => {
    await db.query("UPDATE activity_logs SET meta = ? WHERE id = ?", [JSON.stringify(meta), id]);
};

exports.deleteRefusedApplications = async (months) => {
    const [result] = await db.query(
        "DELETE FROM applications WHERE status = 'refusee' AND updated_at < DATE_SUB(NOW(), INTERVAL ? MONTH) LIMIT 5000",
        [months]
    );
    return result.affectedRows;
};

exports.deleteExpiredPasswordResets = async () => {
    const [result] = await db.query(
        `DELETE FROM password_resets
         WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY) OR used_at < DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 5000`
    );
    return result.affectedRows;
};

exports.deleteOldAuthAttempts = async () => {
    const [result] = await db.query("DELETE FROM auth_attempts WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 5000");
    return result.affectedRows;
};

// Recus d'un compte efface arrives au terme de la conservation comptable : nom et email vides.
exports.purgeRetainedReceipts = async () => {
    const [rows] = await db.query(
        "SELECT payment_id FROM privacy_retained_receipts WHERE purged_at IS NULL AND purge_after <= CURDATE() LIMIT 5000"
    );
    if (!rows.length) return 0;
    const ids = rows.map((row) => row.payment_id);
    const marks = ids.map(() => "?").join(", ");
    await db.query(`UPDATE payments SET receipt_donor_name = 'Donateur anonymisé', receipt_donor_email = NULL WHERE id IN (${marks})`, ids);
    await db.query(`UPDATE privacy_retained_receipts SET purged_at = NOW() WHERE payment_id IN (${marks})`, ids);
    return ids.length;
};
