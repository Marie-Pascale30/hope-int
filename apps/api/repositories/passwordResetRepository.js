const db = require("../config/db");

exports.create = async (userId, tokenHash, ttlMinutes) => {
    // Un seul lien actif a la fois par utilisateur.
    await db.query("UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [userId]);
    await db.query(
        "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
        [userId, tokenHash, ttlMinutes]
    );
};

exports.findValid = async (tokenHash) => {
    const [rows] = await db.query(
        "SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()",
        [tokenHash]
    );
    return rows[0];
};

exports.markUsed = async (id) => {
    await db.query("UPDATE password_resets SET used_at = NOW() WHERE id = ?", [id]);
};
