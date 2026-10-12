// Benevolat, validation des contenus et evenements :
// - presences et heures a un evenement (colonnes de event_registrations) ;
// - heures de benevolat hors evenement (volunteer_hours) ;
// - attestations de benevolat figees a l'emission, avec code de verification (volunteer_certificates) ;
// - liste d'attente des evenements complets (event_waitlist) et rappel envoye une seule fois
//   (events.reminder_sent_at) ;
// - workflow de validation des contenus : statut, commentaire et auteur de la soumission sur
//   projects / news / testimonials, historique des decisions (content_reviews).
//   Compatibilite : published reste la seule source de verite du site public ; les contenus
//   existants recoivent le statut "published" (published = 1) ou "draft" (published = 0).
// Rejouable : chaque helper verifie l'etat du schema avant de le modifier. Aucune dependance
// aux migrations 005, 006 et 008.
const { addColumn, addIndex } = require("../config/schema");

exports.up = async ({ db }) => {
    // --- Presences ---
    await addColumn("event_registrations", "attendance", "VARCHAR(10) NULL");
    await addColumn("event_registrations", "hours", "DECIMAL(6,2) NULL");
    await addColumn("event_registrations", "attendance_by", "INT NULL");
    await addColumn("event_registrations", "attendance_at", "DATETIME NULL");
    await addIndex("event_registrations", "idx_event_registrations_user", "INDEX idx_event_registrations_user (user_id, attendance)");

    // --- Heures hors evenement ---
    await db.query(`
    CREATE TABLE IF NOT EXISTS volunteer_hours (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      mission VARCHAR(255) NOT NULL,
      activity_date DATE NOT NULL,
      hours DECIMAL(6,2) NOT NULL,
      description TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_volunteer_hours_user (user_id, activity_date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    // --- Attestations (donnees figees a l'emission) ---
    await db.query(`
    CREATE TABLE IF NOT EXISTS volunteer_certificates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(24) NOT NULL,
      user_id INT NULL,
      holder_name VARCHAR(150) NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      total_hours DECIMAL(8,2) NOT NULL,
      event_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
      other_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
      events_count INT NOT NULL DEFAULT 0,
      missions_count INT NOT NULL DEFAULT 0,
      badges TEXT NULL,
      issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_volunteer_certificates_code (code),
      INDEX idx_volunteer_certificates_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    // --- Liste d'attente et rappels ---
    await db.query(`
    CREATE TABLE IF NOT EXISTS event_waitlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_event_waitlist (event_id, user_id),
      INDEX idx_event_waitlist_order (event_id, id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
    await addColumn("events", "reminder_sent_at", "DATETIME NULL");

    // --- Workflow de validation des contenus ---
    for (const table of ["projects", "news", "testimonials"]) {
        await addColumn(table, "review_status", "VARCHAR(20) NULL");
        await addColumn(table, "review_comment", "TEXT NULL");
        await addColumn(table, "submitted_by", "INT NULL");
        await addColumn(table, "submitted_at", "DATETIME NULL");
        await addColumn(table, "reviewed_by", "INT NULL");
        await addColumn(table, "reviewed_at", "DATETIME NULL");
        await addIndex(table, `idx_${table}_review_status`, `INDEX idx_${table}_review_status (review_status)`);
        await db.query(
            `UPDATE ${table} SET review_status = IF(published = 1, 'published', 'draft') WHERE review_status IS NULL`
        );
    }

    await db.query(`
    CREATE TABLE IF NOT EXISTS content_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      content_type VARCHAR(20) NOT NULL,
      content_id INT NOT NULL,
      action VARCHAR(20) NOT NULL,
      actor_id INT NULL,
      comment TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_content_reviews_item (content_type, content_id),
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
};
