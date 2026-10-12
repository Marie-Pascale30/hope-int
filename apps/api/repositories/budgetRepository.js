// Budget previsionnel des projets : lignes par categorie, dans leur devise de saisie.
const db = require("../config/db");
const { XAF_PER_EUR } = require("@hope/shared/constants");

// Montant d'une ligne (alias "b") converti en euros (parite fixe du franc CFA).
const BUDGET_EUR_SQL = `CASE WHEN b.currency = 'xaf' THEN b.amount / ${XAF_PER_EUR} ELSE b.amount END`;

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

function mapLine(row) {
    if (!row) return row;
    return { ...row, amount: Number(row.amount) };
}

exports.BUDGET_EUR_SQL = BUDGET_EUR_SQL;

exports.listForProject = async (projectId) => {
    const [rows] = await db.query(
        `SELECT b.id, b.project_id, b.category, b.label, b.amount, b.currency, b.created_at, b.updated_at
         FROM budget_lines b WHERE b.project_id = ? ORDER BY b.category, b.id`,
        [projectId]
    );
    return rows.map(mapLine);
};

exports.findById = async (id) => {
    const [rows] = await db.query(
        `SELECT b.*, pr.region AS project_region FROM budget_lines b
         JOIN projects pr ON pr.id = b.project_id WHERE b.id = ?`,
        [id]
    );
    return mapLine(rows[0]);
};

exports.create = async ({ projectId, category, label, amount, currency, userId }) => {
    const [result] = await db.query(
        "INSERT INTO budget_lines (project_id, category, label, amount, currency, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        [projectId, category, label || null, amount, currency, userId || null]
    );
    return result.insertId;
};

exports.update = async (id, { category, label, amount, currency }) => {
    await db.query(
        "UPDATE budget_lines SET category = ?, label = ?, amount = ?, currency = ? WHERE id = ?",
        [category, label || null, amount, currency, id]
    );
};

exports.remove = async (id) => {
    const [result] = await db.query("DELETE FROM budget_lines WHERE id = ?", [id]);
    return result.affectedRows;
};

// Prevu en euros par categorie (un projet, ou tous les projets d'une liste).
exports.plannedByCategory = async (projectId) => {
    const [rows] = await db.query(
        `SELECT b.category, COALESCE(SUM(${BUDGET_EUR_SQL}), 0) AS planned_eur
         FROM budget_lines b WHERE b.project_id = ? GROUP BY b.category`,
        [projectId]
    );
    return rows.map((row) => ({ category: row.category, plannedEur: round(row.planned_eur) }));
};

// Prevu total en euros par projet (projectIds : null = tous).
exports.plannedByProject = async (projectIds = null) => {
    if (Array.isArray(projectIds) && projectIds.length === 0) return new Map();
    const where = Array.isArray(projectIds) ? "WHERE b.project_id IN (?)" : "";
    const [rows] = await db.query(
        `SELECT b.project_id, COALESCE(SUM(${BUDGET_EUR_SQL}), 0) AS planned_eur
         FROM budget_lines b ${where} GROUP BY b.project_id`,
        Array.isArray(projectIds) ? [projectIds] : []
    );
    return new Map(rows.map((row) => [Number(row.project_id), round(row.planned_eur)]));
};
