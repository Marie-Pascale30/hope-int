// Transparence financiere et pages publiques :
// - budget previsionnel par projet (lignes par categorie) et depenses realisees avec justificatif ;
// - publication annuelle des chiffres (bascule de la direction) et documents publics (PDF) ;
// - portraits publics de l'equipe (consentement explicite, photo, courte bio).
// Rejouable : CREATE TABLE IF NOT EXISTS et helpers qui verifient l'etat du schema.
const { addColumn, addIndex } = require("../config/schema");

exports.up = async ({ db }) => {
    await db.query(`
    CREATE TABLE IF NOT EXISTS budget_lines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      category VARCHAR(40) NOT NULL,
      label VARCHAR(255) NULL,
      amount DECIMAL(14,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'eur',
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_budget_lines_project (project_id, category),
      CONSTRAINT fk_budget_lines_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_budget_lines_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    // project_id NULL : frais generaux de l'association (non rattaches a un projet).
    // Le justificatif est stocke hors du dossier public /uploads (receipt_path relatif au
    // dossier prive) et n'est servi qu'a la finance, par une route authentifiee.
    await db.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NULL,
      category VARCHAR(40) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'eur',
      spent_on DATE NOT NULL,
      description VARCHAR(500) NOT NULL,
      receipt_path VARCHAR(255) NULL,
      receipt_mime VARCHAR(60) NULL,
      receipt_name VARCHAR(255) NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_expenses_spent (spent_on),
      INDEX idx_expenses_project_spent (project_id, spent_on),
      CONSTRAINT fk_expenses_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      CONSTRAINT fk_expenses_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    // Une annee n'est exposee publiquement qu'une fois "publiee" par la direction.
    await db.query(`
    CREATE TABLE IF NOT EXISTS transparency_years (
      year INT PRIMARY KEY,
      published TINYINT(1) NOT NULL DEFAULT 0,
      note TEXT NULL,
      published_at DATETIME NULL,
      published_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_transparency_years_user FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS public_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      year INT NOT NULL,
      kind VARCHAR(40) NOT NULL DEFAULT 'annual_report',
      file_url VARCHAR(500) NOT NULL,
      file_size INT NOT NULL DEFAULT 0,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_public_documents_year (year),
      CONSTRAINT fk_public_documents_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

    // Portrait public : jamais affiche sans consentement explicite (public_profile = 1, date tracee).
    await addColumn("users", "public_profile", "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumn("users", "public_consent_at", "DATETIME NULL");
    await addColumn("users", "public_title", "VARCHAR(120) NULL");
    await addColumn("users", "public_bio", "VARCHAR(600) NULL");
    await addColumn("users", "public_photo_url", "VARCHAR(500) NULL");
    await addIndex("users", "idx_users_public_profile", "INDEX idx_users_public_profile (public_profile, status)");
};
