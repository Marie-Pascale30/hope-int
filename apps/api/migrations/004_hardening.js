// Durcissement :
// - texte alternatif des images (projets, actualites, temoignages, evenements) ;
// - fin de la periode en cours d'un don mensuel (prochaine echeance affichee dans l'espace membre) ;
// - tentatives d'authentification par compte (limitation du login et du mot de passe oublie) ;
// - date de paiement renseignee pour les anciens dons confirmes, pour que les bilans filtrent
//   sur paid_at (index idx_payments_status_paid).
// Rejouable : chaque helper verifie l'etat du schema avant de le modifier.
const { addColumn, addIndex } = require("../config/schema");

exports.up = async ({ db }) => {
    for (const table of ["projects", "news", "testimonials", "events"]) {
        await addColumn(table, "image_alt", "VARCHAR(255) NULL AFTER image_url");
    }

    await addColumn("payments", "subscription_period_end", "DATETIME NULL AFTER subscription_status");

    await db.query(`
    CREATE TABLE IF NOT EXISTS auth_attempts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      scope VARCHAR(20) NOT NULL,
      identifier VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_auth_attempts_lookup (scope, identifier, created_at),
      INDEX idx_auth_attempts_created (created_at)
    )
  `);

    await addIndex("email_outbox", "idx_email_outbox_status_created", "INDEX idx_email_outbox_status_created (status, created_at)");

    await db.query(
        `UPDATE payments SET paid_at = COALESCE(receipt_issued_at, created_at)
         WHERE paid_at IS NULL AND status IN ('succeeded', 'refunded', 'disputed')`
    );
};
