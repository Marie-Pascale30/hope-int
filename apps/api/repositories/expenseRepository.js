// Depenses realisees (par projet ou frais generaux), dans leur devise de saisie.
const db = require("../config/db");
const { XAF_PER_EUR } = require("@hope/shared/constants");

// Montant d'une depense (alias "x") converti en euros.
const EXPENSE_EUR_SQL = `CASE WHEN x.currency = 'xaf' THEN x.amount / ${XAF_PER_EUR} ELSE x.amount END`;

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

// Le chemin disque du justificatif ne sort jamais de l'API : seul has_receipt est expose.
function mapExpense(row) {
    if (!row) return row;
    const { receipt_path: receiptPath, ...rest } = row;
    return { ...rest, amount: Number(row.amount), has_receipt: Boolean(receiptPath) };
}

// Filtres communs : projet (ou frais generaux), region (via le projet), periode [from, to] (dates incluses), categorie.
function buildWhere({ projectId, general, region, from, to, category } = {}) {
    const clauses = [];
    const params = [];
    // general : frais generaux (depenses sans projet).
    if (general) clauses.push("x.project_id IS NULL");
    if (projectId) {
        clauses.push("x.project_id = ?");
        params.push(projectId);
    }
    if (region) {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    if (from) {
        clauses.push("x.spent_on >= ?");
        params.push(from);
    }
    if (to) {
        clauses.push("x.spent_on <= ?");
        params.push(to);
    }
    if (category) {
        clauses.push("x.category = ?");
        params.push(category);
    }
    return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

const FROM = "FROM expenses x LEFT JOIN projects pr ON pr.id = x.project_id";

exports.EXPENSE_EUR_SQL = EXPENSE_EUR_SQL;

exports.list = async (filters = {}, { limit = 500 } = {}) => {
    const where = buildWhere(filters);
    const [rows] = await db.query(
        `SELECT x.id, x.project_id, pr.title AS project_title, pr.region AS project_region, x.category, x.amount,
                x.currency, x.spent_on, x.description, x.receipt_path, x.receipt_mime, x.receipt_name,
                x.created_at, x.updated_at
         ${FROM} ${where.sql}
         ORDER BY x.spent_on DESC, x.id DESC LIMIT ?`,
        [...where.params, Number(limit)]
    );
    return rows.map(mapExpense);
};

// Ligne brute (avec receipt_path) : usage interne au service.
exports.findRawById = async (id) => {
    const [rows] = await db.query(
        `SELECT x.*, pr.region AS project_region ${FROM} WHERE x.id = ?`,
        [id]
    );
    return rows[0] ? { ...rows[0], amount: Number(rows[0].amount) } : null;
};

exports.toPublic = mapExpense;

exports.create = async (data) => {
    const [result] = await db.query(
        `INSERT INTO expenses (project_id, category, amount, currency, spent_on, description, receipt_path, receipt_mime, receipt_name, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.projectId || null, data.category, data.amount, data.currency, data.spentOn, data.description,
            data.receiptPath || null, data.receiptMime || null, data.receiptName || null, data.userId || null,
        ]
    );
    return result.insertId;
};

exports.update = async (id, data) => {
    const fields = {
        project_id: data.projectId || null,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        spent_on: data.spentOn,
        description: data.description,
    };
    if (data.receiptPath !== undefined) {
        fields.receipt_path = data.receiptPath;
        fields.receipt_mime = data.receiptMime;
        fields.receipt_name = data.receiptName;
    }
    const columns = Object.keys(fields);
    await db.query(
        `UPDATE expenses SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
        [...columns.map((column) => fields[column]), id]
    );
};

exports.remove = async (id) => {
    const [result] = await db.query("DELETE FROM expenses WHERE id = ?", [id]);
    return result.affectedRows;
};

// Total en euros par categorie sur les filtres donnes.
exports.sumByCategory = async (filters = {}) => {
    const where = buildWhere(filters);
    const [rows] = await db.query(
        `SELECT x.category, COALESCE(SUM(${EXPENSE_EUR_SQL}), 0) AS amount_eur, COUNT(*) AS count
         ${FROM} ${where.sql} GROUP BY x.category ORDER BY amount_eur DESC`,
        where.params
    );
    return rows.map((row) => ({ category: row.category, amountEur: round(row.amount_eur), count: Number(row.count) }));
};

// Total en euros par projet (project_id null : frais generaux).
exports.sumByProject = async (filters = {}) => {
    const where = buildWhere(filters);
    const [rows] = await db.query(
        `SELECT x.project_id, pr.title AS project_title, pr.published AS project_published,
                COALESCE(SUM(${EXPENSE_EUR_SQL}), 0) AS amount_eur
         ${FROM} ${where.sql} GROUP BY x.project_id, pr.title, pr.published ORDER BY amount_eur DESC`,
        where.params
    );
    return rows.map((row) => ({
        projectId: row.project_id === null ? null : Number(row.project_id),
        title: row.project_title,
        published: Boolean(row.project_published),
        amountEur: round(row.amount_eur),
    }));
};
