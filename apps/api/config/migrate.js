const fs = require("fs");
const path = require("path");
const db = require("./db");

// Migrations versionnees : chaque fichier migrations/NNN_nom.js exporte up() et n'est execute
// qu'une seule fois (suivi dans schema_migrations). MySQL valide implicitement les DDL : une
// migration n'est donc pas transactionnelle et doit rester rejouable si elle echoue en cours.
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const LOCK_NAME = "hope_schema_migrations";

function listMigrations() {
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => /^\d{3,}_[\w-]+\.js$/.test(file))
        .sort()
        .map((file) => ({ name: file.replace(/\.js$/, ""), file: path.join(MIGRATIONS_DIR, file) }));
}

async function ensureTable() {
    await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function appliedNames() {
    const [rows] = await db.query("SELECT name FROM schema_migrations");
    return new Set(rows.map((row) => row.name));
}

async function status() {
    await ensureTable();
    const applied = await appliedNames();
    return listMigrations().map(({ name }) => ({ name, applied: applied.has(name) }));
}

async function runMigrations({ log = console.log } = {}) {
    await ensureTable();

    // Verrou nomme : plusieurs instances de l'API peuvent demarrer en meme temps.
    const lockConnection = await db.getConnection();
    try {
        const [[{ locked }]] = await lockConnection.query("SELECT GET_LOCK(?, 60) AS locked", [LOCK_NAME]);
        if (locked !== 1) throw new Error("Verrou de migration indisponible (une autre instance migre ?)");

        const applied = await appliedNames();
        const pending = listMigrations().filter(({ name }) => !applied.has(name));

        for (const migration of pending) {
            log(`migration: ${migration.name}`);
            await require(migration.file).up({ db });
            await db.query("INSERT INTO schema_migrations (name) VALUES (?)", [migration.name]);
        }
        return pending.map(({ name }) => name);
    } finally {
        await lockConnection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => {});
        lockConnection.release();
    }
}

module.exports = { runMigrations, status, listMigrations };
