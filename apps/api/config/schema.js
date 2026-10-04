const db = require("./db");

// Outils pour ecrire des migrations rejouables : chaque helper verifie l'etat du schema
// avant de le modifier.

async function columnExists(table, column) {
    const [rows] = await db.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        [table, column]
    );
    return rows.length > 0;
}

async function indexExists(table, index) {
    const [rows] = await db.query(
        "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
        [table, index]
    );
    return rows.length > 0;
}

async function addColumn(table, column, definition) {
    if (!(await columnExists(table, column))) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

async function addIndex(table, index, definition) {
    if (!(await indexExists(table, index))) {
        await db.query(`ALTER TABLE ${table} ADD ${definition}`);
    }
}

module.exports = { columnExists, indexExists, addColumn, addIndex };
