// Engagement, conformite et relation donateurs :
// - consentements de communication (historique horodate : preuve de l'accord ou du retrait) ;
// - double authentification TOTP (secret chiffre, codes de secours haches) ;
// - effacement RGPD (compte anonymise, recus conserves pendant la duree comptable) ;
// - CRM donateurs (notes, etiquettes) ;
// - nouvelles des projets envoyees aux donateurs (une seule fois par actualite) ;
// - newsletter et campagnes (modeles, campagnes, destinataires).
// Rejouable : CREATE TABLE IF NOT EXISTS et helpers verifiant l'etat du schema.
const { addColumn, addIndex } = require("../config/schema");

exports.up = async ({ db }) => {
    await db.query(`
    CREATE TABLE IF NOT EXISTS consents (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      email VARCHAR(180) NULL,
      topic VARCHAR(40) NOT NULL,
      granted TINYINT(1) NOT NULL,
      source VARCHAR(40) NOT NULL,
      text_version VARCHAR(40) NULL,
      ref VARCHAR(60) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_consents_email (email, topic, id),
      INDEX idx_consents_user (user_id, topic, id),
      INDEX idx_consents_ref (ref, granted)
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS user_mfa (
      user_id INT PRIMARY KEY,
      secret_enc VARCHAR(255) NOT NULL,
      enabled_at DATETIME NULL,
      last_used_step BIGINT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_mfa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS user_mfa_backup_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      code_hash CHAR(64) NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_mfa_backup_user (user_id, code_hash),
      CONSTRAINT fk_mfa_backup_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    // Compte anonymise a la demande de son titulaire (le compte reste pour l'historique).
    await addColumn("users", "anonymized_at", "DATETIME NULL");

    // Recus conserves apres effacement : les champs receipt_* sont vides a l'echeance comptable.
    await db.query(`
    CREATE TABLE IF NOT EXISTS privacy_retained_receipts (
      payment_id INT PRIMARY KEY,
      purge_after DATE NOT NULL,
      purged_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_retained_purge (purged_at, purge_after)
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS donor_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      donor_key VARCHAR(200) NOT NULL,
      author_id INT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_donor_notes_key (donor_key),
      CONSTRAINT fk_donor_notes_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS donor_tags (
      donor_key VARCHAR(200) NOT NULL,
      tag VARCHAR(40) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (donor_key, tag),
      INDEX idx_donor_tags_tag (tag)
    )
  `);

    // Marqueur "deja envoyee" : la cle primaire garantit un seul envoi par actualite.
    await db.query(`
    CREATE TABLE IF NOT EXISTS project_news_dispatches (
      news_id INT PRIMARY KEY,
      project_id INT NULL,
      sent_by INT NULL,
      recipients INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_news_dispatch_news FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
      CONSTRAINT fk_news_dispatch_user FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS campaign_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_campaign_templates_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      topic VARCHAR(40) NOT NULL DEFAULT 'newsletter',
      audience VARCHAR(60) NOT NULL DEFAULT 'newsletter',
      audience_params TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by INT NULL,
      started_at DATETIME NULL,
      sent_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_campaigns_status (status),
      CONSTRAINT fk_campaigns_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS campaign_recipients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT NOT NULL,
      email VARCHAR(180) NOT NULL,
      outbox_id INT NULL,
      skipped TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_campaign_recipient (campaign_id, email),
      INDEX idx_campaign_recipients_outbox (outbox_id),
      CONSTRAINT fk_campaign_recipients_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

    // Purge des journaux anonymises (meta) et lecture des dons par email.
    await addIndex("payments", "idx_payments_donor_email", "INDEX idx_payments_donor_email (donor_email)");
    await addIndex("password_resets", "idx_password_resets_expires", "INDEX idx_password_resets_expires (expires_at)");
};
