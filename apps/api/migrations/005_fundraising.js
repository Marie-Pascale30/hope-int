// Collecte de fonds (dons etendus) :
// - source du don (?ref=), dons en hommage / en memoire (e-carte au proche, mention figee sur le recu) ;
// - relance des paiements abandonnes (compteur et date de la derniere relance) ;
// - dons hors ligne saisis par la finance (especes, virement, cheque, en nature) avec justificatif
//   et validation par une seconde personne ;
// - engagements de don mensuel par Mobile Money (rappels mensuels, suivi de regularite) ;
// - date de fin des dons mensuels Stripe (attrition) ;
// - marqueurs d'envoi idempotents (recapitulatifs fiscaux annuels, relances de carte, e-cartes) ;
// - collectes personnelles (pages de collecte des membres, moderees avant publication).
// Rejouable : chaque etape verifie l'etat du schema avant de le modifier.
const { addColumn, addIndex } = require("../config/schema");

async function addPaymentColumns() {
    // Source du don (lien partage, campagne...) : 60 caracteres nettoyes.
    await addColumn("payments", "source", "VARCHAR(60) NULL");
    // Hommage : en l'honneur de (honor) / a la memoire de (memory).
    await addColumn("payments", "tribute_type", "VARCHAR(10) NULL");
    await addColumn("payments", "tribute_name", "VARCHAR(120) NULL");
    await addColumn("payments", "tribute_notify_email", "VARCHAR(180) NULL");
    await addColumn("payments", "tribute_message", "VARCHAR(300) NULL");
    await addColumn("payments", "tribute_notified_at", "DATETIME NULL");
    await addColumn("payments", "receipt_tribute", "VARCHAR(255) NULL");
    // Relances des paiements abandonnes.
    await addColumn("payments", "reminder_count", "TINYINT NOT NULL DEFAULT 0");
    await addColumn("payments", "reminder_sent_at", "DATETIME NULL");
    // Rattachements : engagement Mobile Money, collecte personnelle.
    await addColumn("payments", "pledge_id", "INT NULL");
    await addColumn("payments", "fundraiser_id", "INT NULL");
    // Soutien affiche anonymement sur la page publique d'une collecte.
    await addColumn("payments", "public_anonymous", "TINYINT(1) NOT NULL DEFAULT 0");
    // Fin d'un don mensuel Stripe (indicateur d'attrition).
    await addColumn("payments", "subscription_ended_at", "DATETIME NULL");

    await addIndex("payments", "idx_payments_source", "INDEX idx_payments_source (source)");
    await addIndex("payments", "idx_payments_pledge", "INDEX idx_payments_pledge (pledge_id)");
    await addIndex("payments", "idx_payments_fundraiser", "INDEX idx_payments_fundraiser (fundraiser_id, status)");
    await addIndex("payments", "idx_payments_reminder", "INDEX idx_payments_reminder (status, reminder_count, created_at)");
    await addIndex("payments", "idx_payments_donor_email", "INDEX idx_payments_donor_email (donor_email)");
}

async function createTables(db) {
    // Dons hors ligne : saisis par une personne de la finance, valides par une autre.
    // Le justificatif (image ou PDF, 5 Mo max) reste en base : jamais servi publiquement.
    await db.query(`
    CREATE TABLE IF NOT EXISTS donation_offline (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kind VARCHAR(20) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      donor_name VARCHAR(150) NOT NULL,
      donor_email VARCHAR(180) NULL,
      user_id INT NULL,
      project_id INT NULL,
      received_on DATE NOT NULL,
      reference VARCHAR(100) NULL,
      in_kind_description VARCHAR(255) NULL,
      note VARCHAR(500) NULL,
      proof_data MEDIUMBLOB NULL,
      proof_mime VARCHAR(60) NULL,
      proof_name VARCHAR(150) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending_validation',
      created_by INT NOT NULL,
      validated_by INT NULL,
      validated_at DATETIME NULL,
      rejected_reason VARCHAR(500) NULL,
      payment_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_donation_offline_status (status, created_at),
      UNIQUE INDEX uq_donation_offline_payment (payment_id)
    )
  `);

    // Engagements de don mensuel par Mobile Money : rappel mensuel avec lien de paiement pre-rempli.
    // manage_token_hash : gestion sans compte (lien envoye par email) ; pay_ref : rattachement des
    // dons a l'engagement (non secret : il figure dans le lien de paiement partageable).
    await db.query(`
    CREATE TABLE IF NOT EXISTS donation_pledges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      donor_name VARCHAR(150) NOT NULL,
      donor_email VARCHAR(180) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'xaf',
      day_of_month TINYINT NOT NULL,
      project_id INT NULL,
      channel VARCHAR(20) NOT NULL DEFAULT 'email',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      manage_token_hash CHAR(64) NOT NULL,
      pay_ref CHAR(24) NOT NULL,
      last_reminder_period CHAR(7) NULL,
      last_reminder_at DATETIME NULL,
      stopped_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX uq_donation_pledges_token (manage_token_hash),
      UNIQUE INDEX uq_donation_pledges_pay_ref (pay_ref),
      INDEX idx_donation_pledges_user (user_id),
      INDEX idx_donation_pledges_due (status, day_of_month)
    )
  `);

    // Rappels envoyes par engagement et par mois (suivi des echeances payees / manquees).
    await db.query(`
    CREATE TABLE IF NOT EXISTS donation_pledge_reminders (
      pledge_id INT NOT NULL,
      period CHAR(7) NOT NULL,
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (pledge_id, period)
    )
  `);

    // Marqueurs d'envoi idempotents (une seule fois par cle) : recapitulatifs annuels, relances...
    await db.query(`
    CREATE TABLE IF NOT EXISTS fundraising_markers (
      kind VARCHAR(40) NOT NULL,
      ref_key VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (kind, ref_key)
    )
  `);

    // Collectes personnelles : page creee par un membre, rattachee a un projet, moderee avant
    // publication (pending -> published | rejected ; published -> closed).
    await db.query(`
    CREATE TABLE IF NOT EXISTS fundraisers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      project_id INT NOT NULL,
      slug VARCHAR(80) NOT NULL,
      title VARCHAR(120) NOT NULL,
      story TEXT NOT NULL,
      goal_amount DECIMAL(12,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'eur',
      ends_on DATE NULL,
      image_url VARCHAR(500) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      moderation_note VARCHAR(500) NULL,
      moderated_by INT NULL,
      moderated_at DATETIME NULL,
      published_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX uq_fundraisers_slug (slug),
      INDEX idx_fundraisers_status (status, created_at),
      INDEX idx_fundraisers_user (user_id)
    )
  `);
}

exports.up = async ({ db }) => {
    await addPaymentColumns();
    await createTables(db);
    // Dons mensuels deja arretes : date de fin approchee (derniere mise a jour inconnue).
    await db.query(
        `UPDATE payments SET subscription_ended_at = COALESCE(paid_at, created_at)
         WHERE subscription_status = 'canceled' AND subscription_ended_at IS NULL`
    );
};
