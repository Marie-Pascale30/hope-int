// Schema de reference : toutes les tables et colonnes existantes au passage aux migrations
// versionnees. Ecrite de facon rejouable (CREATE IF NOT EXISTS, colonnes ajoutees si absentes),
// elle s'applique aussi bien a une base vide qu'a une base creee par l'ancien initDb.
const db = require("../config/db");
const { addColumn, addIndex } = require("../config/schema");

async function createTables() {
    await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(180) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(80) NOT NULL DEFAULT 'membre',
      roles TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      image_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      amount DECIMAL(12,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'eur',
      method VARCHAR(50) DEFAULT 'card',
      status VARCHAR(40) NOT NULL,
      transaction_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(180) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      message_type VARCHAR(40) NOT NULL DEFAULT 'general',
      desired_roles TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      author VARCHAR(150) NOT NULL,
      content TEXT NOT NULL,
      image_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS news (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      image_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      action VARCHAR(255) NOT NULL,
      meta JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(180) NOT NULL,
      phone VARCHAR(40) NULL,
      region VARCHAR(80) NULL,
      desired_roles TEXT NULL,
      motivation TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'nouvelle',
      reviewer_id INT NULL,
      review_note TEXT NULL,
      user_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_applications_status (status),
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      location VARCHAR(255) NOT NULL,
      region VARCHAR(80) NULL,
      start_at DATETIME NOT NULL,
      end_at DATETIME NULL,
      capacity INT NULL,
      image_url VARCHAR(500) NULL,
      project_id INT NULL,
      published TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_events_start (start_at),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS event_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_event_user (event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_resets_token (token_hash),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function migrateUsers() {
    await db.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(80) NOT NULL DEFAULT 'membre'");
    await addColumn("users", "roles", "TEXT NULL AFTER role");
    await addColumn("users", "phone", "VARCHAR(40) NULL");
    await addColumn("users", "region", "VARCHAR(80) NULL");
    await addColumn("users", "skills", "TEXT NULL");
    await addColumn("users", "availability", "VARCHAR(255) NULL");
    await addColumn("users", "status", "VARCHAR(20) NOT NULL DEFAULT 'active'");
    await addColumn("users", "must_change_password", "TINYINT(1) NOT NULL DEFAULT 0");
    // Incremente a chaque changement de mot de passe / desactivation : invalide les anciens jetons.
    await addColumn("users", "token_version", "INT NOT NULL DEFAULT 0");
    await addColumn("users", "last_login_at", "DATETIME NULL");

    const [usersWithoutRoles] = await db.query(
        "SELECT id, role FROM users WHERE roles IS NULL OR roles = ''"
    );
    for (const user of usersWithoutRoles) {
        await db.query("UPDATE users SET roles = ? WHERE id = ?", [JSON.stringify([user.role]), user.id]);
    }
}

async function migratePayments() {
    // Un don doit survivre a la suppression du compte du donateur (tracabilite comptable) :
    // user_id devient nullable et la cle etrangere passe de CASCADE a SET NULL.
    const [fks] = await db.query(
        `SELECT rc.CONSTRAINT_NAME AS name, rc.DELETE_RULE AS deleteRule
         FROM information_schema.REFERENTIAL_CONSTRAINTS rc
         JOIN information_schema.KEY_COLUMN_USAGE k
           ON k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
         WHERE rc.CONSTRAINT_SCHEMA = DATABASE() AND k.TABLE_NAME = 'payments' AND k.COLUMN_NAME = 'user_id'`
    );
    const fk = fks[0];
    if (!fk || fk.deleteRule !== "SET NULL") {
        if (fk) await db.query(`ALTER TABLE payments DROP FOREIGN KEY ${fk.name}`);
        await db.query("ALTER TABLE payments MODIFY COLUMN user_id INT NULL");
        await db.query(
            "ALTER TABLE payments ADD CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"
        );
    }

    await db.query("ALTER TABLE payments MODIFY COLUMN amount DECIMAL(12,2) NOT NULL");
    await addColumn("payments", "provider", "VARCHAR(30) NOT NULL DEFAULT 'stripe' AFTER method");
    await addColumn("payments", "donor_name", "VARCHAR(150) NULL");
    await addColumn("payments", "donor_email", "VARCHAR(180) NULL");
    await addColumn("payments", "project_id", "INT NULL");
    await addColumn("payments", "frequency", "VARCHAR(20) NOT NULL DEFAULT 'once'");
    await addColumn("payments", "subscription_id", "VARCHAR(255) NULL");
    await addColumn("payments", "receipt_number", "VARCHAR(40) NULL");
    await addColumn("payments", "receipt_token", "CHAR(48) NULL");
    await addColumn("payments", "paid_at", "DATETIME NULL");
    await addColumn("payments", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

    // Anciennes lignes : method contenait le prestataire.
    await db.query("UPDATE payments SET provider = 'stripe', method = 'card' WHERE method = 'stripe'");
    await db.query("UPDATE payments SET status = 'succeeded' WHERE status = 'completed'");

    await addIndex("payments", "idx_payments_transaction_id", "INDEX idx_payments_transaction_id (transaction_id)");
    await addIndex("payments", "idx_payments_created_at", "INDEX idx_payments_created_at (created_at)");
    await addIndex("payments", "idx_payments_project", "INDEX idx_payments_project (project_id)");
    await addIndex("payments", "uq_payments_receipt_number", "UNIQUE INDEX uq_payments_receipt_number (receipt_number)");
    await addIndex("payments", "uq_payments_receipt_token", "UNIQUE INDEX uq_payments_receipt_token (receipt_token)");

    const [projectFk] = await db.query(
        `SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'project_id' AND REFERENCED_TABLE_NAME = 'projects'`
    );
    if (!projectFk.length) {
        await db.query(
            "ALTER TABLE payments ADD CONSTRAINT fk_payments_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL"
        );
    }
}

async function migrateContent() {
    await addColumn("projects", "summary", "VARCHAR(500) NULL");
    await addColumn("projects", "status", "VARCHAR(20) NOT NULL DEFAULT 'en_cours'");
    await addColumn("projects", "region", "VARCHAR(80) NULL");
    await addColumn("projects", "start_date", "DATE NULL");
    await addColumn("projects", "end_date", "DATE NULL");
    await addColumn("projects", "budget", "DECIMAL(12,2) NULL");
    // Objectif de collecte (EUR) : un projet avec objectif est une campagne de dons.
    await addColumn("projects", "goal_amount", "DECIMAL(12,2) NULL");
    await addColumn("projects", "beneficiaries", "INT NOT NULL DEFAULT 0");
    await addColumn("projects", "trainees", "INT NOT NULL DEFAULT 0");
    await addColumn("projects", "credits_granted", "INT NOT NULL DEFAULT 0");
    await addColumn("projects", "published", "TINYINT(1) NOT NULL DEFAULT 1");
    await addColumn("projects", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

    await addColumn("news", "summary", "VARCHAR(500) NULL");
    await addColumn("news", "project_id", "INT NULL");
    await addColumn("news", "published", "TINYINT(1) NOT NULL DEFAULT 1");
    await addColumn("news", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

    await addColumn("testimonials", "role_label", "VARCHAR(150) NULL");
    await addColumn("testimonials", "project_id", "INT NULL");
    await addColumn("testimonials", "published", "TINYINT(1) NOT NULL DEFAULT 1");
    await addColumn("testimonials", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
}

async function migrateMessages() {
    await addColumn("messages", "message_type", "VARCHAR(40) NOT NULL DEFAULT 'general' AFTER content");
    await addColumn("messages", "desired_roles", "TEXT NULL AFTER message_type");
    await addColumn("messages", "status", "VARCHAR(20) NOT NULL DEFAULT 'nouveau'");
    await addColumn("messages", "assigned_to", "INT NULL");
    await addColumn("messages", "notes", "TEXT NULL");
    await addColumn("messages", "handled_at", "DATETIME NULL");

    // Les anciennes demandes d'integration stockees comme messages deviennent des candidatures.
    const [joinRequests] = await db.query("SELECT * FROM messages WHERE message_type = 'join_request'");
    for (const row of joinRequests) {
        await db.query(
            "INSERT INTO applications (name, email, desired_roles, motivation, created_at) VALUES (?, ?, ?, ?, ?)",
            [row.name, row.email, row.desired_roles || "[]", row.content, row.created_at]
        );
        await db.query("DELETE FROM messages WHERE id = ?", [row.id]);
    }
}

exports.up = async () => {
    await createTables();
    await migrateUsers();
    await migratePayments();
    await migrateContent();
    await migrateMessages();
    await addIndex("activity_logs", "idx_activity_logs_created_at", "INDEX idx_activity_logs_created_at (created_at)");
};
