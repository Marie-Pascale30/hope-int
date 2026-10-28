// Double authentification des comptes de l'equipe (permission access_admin_dashboard) par code
// a usage unique envoye par email (remplace le TOTP retire par 010_drop_totp_mfa) :
// - login_challenges : connexion en attente du code (jeton opaque et code haches, 10 minutes,
//   5 essais au plus, renvoi limite) ;
// - trusted_devices : appareils de confiance (cookie hope_device, 30 jours). Un appareil n'est
//   reconnu que si token_version n'a pas change depuis : un changement de mot de passe ou une
//   deconnexion de toutes les sessions les revoque tous.
// Rejouable : CREATE TABLE IF NOT EXISTS.

exports.up = async ({ db }) => {
    await db.query(`
    CREATE TABLE IF NOT EXISTS login_challenges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      code_hash CHAR(64) NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      send_count INT NOT NULL DEFAULT 1,
      last_sent_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_login_challenges_token (token_hash),
      INDEX idx_login_challenges_user (user_id, used_at),
      INDEX idx_login_challenges_expires (expires_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS trusted_devices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      token_version INT NOT NULL DEFAULT 0,
      user_agent VARCHAR(255) NULL,
      expires_at DATETIME NOT NULL,
      last_used_at DATETIME NULL,
      revoked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_trusted_devices_token (token_hash),
      INDEX idx_trusted_devices_user (user_id),
      INDEX idx_trusted_devices_expires (expires_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
};
