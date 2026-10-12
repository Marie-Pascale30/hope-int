const db = require("../config/db");

// Double authentification : un secret TOTP (chiffre) par compte et des codes de secours haches.

exports.find = async (userId) => {
    const [rows] = await db.query("SELECT user_id, secret_enc, enabled_at, last_used_step FROM user_mfa WHERE user_id = ?", [userId]);
    return rows[0] || null;
};

// Nouveau secret en attente de confirmation (remplace un secret non active).
exports.savePending = async (userId, secretEnc) => {
    await db.query(
        `INSERT INTO user_mfa (user_id, secret_enc, enabled_at, last_used_step) VALUES (?, ?, NULL, NULL)
         ON DUPLICATE KEY UPDATE secret_enc = VALUES(secret_enc), enabled_at = NULL, last_used_step = NULL`,
        [userId, secretEnc]
    );
};

exports.enable = async (userId) => {
    const [result] = await db.query("UPDATE user_mfa SET enabled_at = NOW() WHERE user_id = ? AND enabled_at IS NULL", [userId]);
    return result.affectedRows > 0;
};

// Anti-rejeu : un pas de temps n'est accepte qu'une fois (et jamais un pas anterieur au dernier utilise).
exports.consumeStep = async (userId, step) => {
    const [result] = await db.query(
        "UPDATE user_mfa SET last_used_step = ? WHERE user_id = ? AND (last_used_step IS NULL OR last_used_step < ?)",
        [step, userId, step]
    );
    return result.affectedRows > 0;
};

exports.remove = async (userId, connection = db) => {
    await connection.query("DELETE FROM user_mfa_backup_codes WHERE user_id = ?", [userId]);
    await connection.query("DELETE FROM user_mfa WHERE user_id = ?", [userId]);
};

exports.replaceBackupCodes = async (userId, hashes) => {
    await db.query("DELETE FROM user_mfa_backup_codes WHERE user_id = ?", [userId]);
    if (!hashes.length) return;
    await db.query(
        `INSERT INTO user_mfa_backup_codes (user_id, code_hash) VALUES ${hashes.map(() => "(?, ?)").join(", ")}`,
        hashes.flatMap((hash) => [userId, hash])
    );
};

// Consommation atomique d'un code de secours (usage unique).
exports.consumeBackupCode = async (userId, hash) => {
    const [result] = await db.query(
        "UPDATE user_mfa_backup_codes SET used_at = NOW() WHERE user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1",
        [userId, hash]
    );
    return result.affectedRows > 0;
};

exports.countBackupCodes = async (userId) => {
    const [[row]] = await db.query("SELECT COUNT(*) AS total FROM user_mfa_backup_codes WHERE user_id = ? AND used_at IS NULL", [userId]);
    return Number(row.total);
};

// Comptes de l'equipe et etat de leur double authentification (vue d'administration).
exports.statusForUsers = async (ids) => {
    if (!ids.length) return {};
    const [rows] = await db.query(
        `SELECT user_id, enabled_at FROM user_mfa WHERE user_id IN (${ids.map(() => "?").join(", ")})`,
        ids
    );
    return Object.fromEntries(rows.map((row) => [row.user_id, Boolean(row.enabled_at)]));
};
