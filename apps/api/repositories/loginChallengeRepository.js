const db = require("../config/db");

// Connexions en attente du code envoye par email (comptes de l'equipe) et appareils de confiance.
// Les jetons et les codes ne sont jamais stockes en clair (empreintes SHA-256 / HMAC).

// Un seul defi actif par compte : une nouvelle connexion annule les precedents.
exports.createChallenge = async ({ userId, tokenHash, codeHash, ttlMinutes }) => {
    await db.query("UPDATE login_challenges SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [userId]);
    // Purge au fil de l'eau : les defis expires depuis plus d'un jour ne servent plus.
    await db.query("DELETE FROM login_challenges WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 500");
    await db.query(
        `INSERT INTO login_challenges (user_id, token_hash, code_hash, last_sent_at, expires_at)
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [userId, tokenHash, codeHash, ttlMinutes]
    );
};

// Defi encore utilisable (non consomme, non expire, essais restants).
// seconds_since_sent : delai depuis le dernier envoi (calcule par MySQL, pas d'ecart d'horloge).
exports.findActive = async (tokenHash, maxAttempts) => {
    const [rows] = await db.query(
        `SELECT id, user_id, code_hash, attempts, send_count,
                TIMESTAMPDIFF(SECOND, last_sent_at, NOW()) AS seconds_since_sent
         FROM login_challenges
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() AND attempts < ?`,
        [tokenHash, maxAttempts]
    );
    return rows[0];
};

// Code errone : un essai de plus ; le defi est invalide au dernier essai. Renvoie les essais faits.
exports.recordFailure = async (id, maxAttempts) => {
    await db.query(
        `UPDATE login_challenges
         SET attempts = attempts + 1, used_at = IF(attempts >= ?, NOW(), used_at)
         WHERE id = ? AND used_at IS NULL`,
        [maxAttempts, id]
    );
    const [[row]] = await db.query("SELECT attempts FROM login_challenges WHERE id = ?", [id]);
    return Number(row?.attempts || maxAttempts);
};

// Consommation atomique : true pour la seule requete qui valide le defi.
exports.consume = async (id, maxAttempts) => {
    const [result] = await db.query(
        "UPDATE login_challenges SET used_at = NOW() WHERE id = ? AND used_at IS NULL AND expires_at > NOW() AND attempts < ?",
        [id, maxAttempts]
    );
    return result.affectedRows > 0;
};

// Nouveau code : remplace l'ancien, remet les essais a zero et prolonge la validite.
// La condition sur last_sent_at rend le delai entre deux envois sur meme en cas de requetes simultanees.
exports.replaceCode = async (id, codeHash, ttlMinutes, cooldownSeconds) => {
    const [result] = await db.query(
        `UPDATE login_challenges
         SET code_hash = ?, attempts = 0, send_count = send_count + 1, last_sent_at = NOW(),
             expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
         WHERE id = ? AND used_at IS NULL AND last_sent_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)`,
        [codeHash, ttlMinutes, id, cooldownSeconds]
    );
    return result.affectedRows > 0;
};

exports.createTrustedDevice = async ({ userId, tokenHash, tokenVersion, userAgent, ttlDays }) => {
    await db.query("DELETE FROM trusted_devices WHERE expires_at < NOW() OR revoked_at IS NOT NULL LIMIT 500");
    await db.query(
        `INSERT INTO trusted_devices (user_id, token_hash, token_version, user_agent, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [userId, tokenHash, tokenVersion, userAgent ? String(userAgent).slice(0, 255) : null, ttlDays]
    );
};

// Appareil reconnu pour ce compte : non expire, non revoque, et cree depuis le dernier changement
// de token_version (mot de passe modifie, deconnexion de toutes les sessions).
exports.isTrustedDevice = async ({ userId, tokenHash, tokenVersion }) => {
    const [rows] = await db.query(
        `SELECT id FROM trusted_devices
         WHERE token_hash = ? AND user_id = ? AND token_version = ? AND revoked_at IS NULL AND expires_at > NOW()`,
        [tokenHash, userId, tokenVersion]
    );
    if (!rows[0]) return false;
    await db.query("UPDATE trusted_devices SET last_used_at = NOW() WHERE id = ?", [rows[0].id]);
    return true;
};

exports.revokeTrustedDevices = async (userId) => {
    await db.query("UPDATE trusted_devices SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [userId]);
};
