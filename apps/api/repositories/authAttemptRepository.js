const db = require("../config/db");

// Tentatives d'authentification par compte (email normalise) : echecs de connexion et demandes
// de reinitialisation. Stockees en base pour etre partagees entre instances de l'API.

exports.record = async (scope, identifier) => {
    await db.query("INSERT INTO auth_attempts (scope, identifier) VALUES (?, ?)", [scope, identifier]);
    // Purge au fil de l'eau (index sur created_at) : seules les dernieres 24 h sont utiles.
    await db.query("DELETE FROM auth_attempts WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 500");
};

exports.countRecent = async (scope, identifier, minutes) => {
    const [[row]] = await db.query(
        `SELECT COUNT(*) AS total FROM auth_attempts
         WHERE scope = ? AND identifier = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
        [scope, identifier, minutes]
    );
    return Number(row.total);
};

exports.clear = async (scope, identifier) => {
    await db.query("DELETE FROM auth_attempts WHERE scope = ? AND identifier = ?", [scope, identifier]);
};
