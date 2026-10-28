// Retrait de la double authentification TOTP (creee par 006_engagement) : elle sera remplacee
// plus tard par un code a usage unique envoye par email ou SMS (module distinct).
// Les codes de secours sont supprimes avant les secrets ; les deux tables ne referencent que
// users (ON DELETE CASCADE), aucune autre table ne pointe vers elles.
// Rejouable : DROP TABLE IF EXISTS, et la purge des tentatives est sans effet une fois faite.

exports.up = async ({ db }) => {
    await db.query("DROP TABLE IF EXISTS user_mfa_backup_codes");
    await db.query("DROP TABLE IF EXISTS user_mfa");
    // Compteurs d'echecs de saisie du second facteur, devenus inutiles.
    await db.query("DELETE FROM auth_attempts WHERE scope = 'mfa'");
};
