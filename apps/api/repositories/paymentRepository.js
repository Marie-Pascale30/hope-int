const db = require("../config/db");
const { XAF_PER_EUR } = require("@hope/shared/constants");

const EUR_SQL = `CASE WHEN p.currency = 'xaf' THEN p.amount / ${XAF_PER_EUR} ELSE p.amount END`;

const LIST_COLUMNS = `
  p.id, p.user_id, p.amount, p.currency, p.method, p.provider, p.status, p.transaction_id,
  p.frequency, p.subscription_id, p.project_id, p.receipt_number, p.receipt_token, p.paid_at, p.created_at,
  COALESCE(u.name, p.donor_name) AS donor_name,
  COALESCE(u.email, p.donor_email) AS donor_email,
  pr.title AS project_title, pr.region AS project_region`;

const LIST_FROM = `
  FROM payments p
  LEFT JOIN users u ON u.id = p.user_id
  LEFT JOIN projects pr ON pr.id = p.project_id`;

function mapPayment(row) {
    if (!row) return row;
    return { ...row, amount: Number(row.amount) };
}

exports.create = async (data) => {
    const [result] = await db.query(
        `INSERT INTO payments
           (user_id, amount, currency, method, provider, status, transaction_id, donor_name, donor_email,
            project_id, frequency, subscription_id, receipt_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.userId || null,
            data.amount,
            data.currency,
            data.method,
            data.provider,
            data.status || "pending",
            data.txId || null,
            data.donorName || null,
            data.donorEmail || null,
            data.projectId || null,
            data.frequency || "once",
            data.subscriptionId || null,
            data.receiptToken,
        ]
    );
    return result.insertId;
};

exports.setTransactionId = async (id, txId, subscriptionId = null) => {
    await db.query(
        "UPDATE payments SET transaction_id = ?, subscription_id = COALESCE(?, subscription_id) WHERE id = ?",
        [txId, subscriptionId, id]
    );
};

exports.findById = async (id) => {
    const [rows] = await db.query(`SELECT ${LIST_COLUMNS} ${LIST_FROM} WHERE p.id = ?`, [id]);
    return mapPayment(rows[0]);
};

exports.findByTxId = async (txId) => {
    const [rows] = await db.query(`SELECT ${LIST_COLUMNS} ${LIST_FROM} WHERE p.transaction_id = ?`, [txId]);
    return mapPayment(rows[0]);
};

exports.findFirstBySubscription = async (subscriptionId) => {
    const [rows] = await db.query(
        `SELECT ${LIST_COLUMNS} ${LIST_FROM} WHERE p.subscription_id = ? ORDER BY p.id ASC LIMIT 1`,
        [subscriptionId]
    );
    return mapPayment(rows[0]);
};

exports.findByReceiptToken = async (token) => {
    const [rows] = await db.query(`SELECT ${LIST_COLUMNS} ${LIST_FROM} WHERE p.receipt_token = ?`, [token]);
    return mapPayment(rows[0]);
};

exports.updateStatus = async (id, status) => {
    await db.query("UPDATE payments SET status = ? WHERE id = ?", [status, id]);
};

// Passage a "succeeded" : horodatage et numero de recu sequentiel par annee (HOPE-2026-000042).
exports.markSucceeded = async (id) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query(
            "SELECT id, status, receipt_number FROM payments WHERE id = ? FOR UPDATE",
            [id]
        );
        const payment = rows[0];
        if (!payment || (payment.status === "succeeded" && payment.receipt_number)) {
            await connection.commit();
            return false;
        }

        const year = new Date().getFullYear();
        const prefix = `HOPE-${year}-`;
        const [last] = await connection.query(
            "SELECT receipt_number FROM payments WHERE receipt_number LIKE ? ORDER BY receipt_number DESC LIMIT 1 FOR UPDATE",
            [`${prefix}%`]
        );
        const next = last[0] ? Number(last[0].receipt_number.slice(prefix.length)) + 1 : 1;
        const receiptNumber = `${prefix}${String(next).padStart(6, "0")}`;

        await connection.query(
            "UPDATE payments SET status = 'succeeded', paid_at = COALESCE(paid_at, NOW()), receipt_number = ? WHERE id = ?",
            [receiptNumber, id]
        );
        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// Uniquement les dons rattaches au compte : l'email n'etant pas verifie a l'inscription,
// on ne rattache pas les dons anonymes faits avec la meme adresse.
exports.getByUser = async (userId) => {
    const [rows] = await db.query(
        `SELECT ${LIST_COLUMNS} ${LIST_FROM} WHERE p.user_id = ? ORDER BY p.created_at DESC`,
        [userId]
    );
    return rows.map(mapPayment);
};

function buildFilters({ status, from, to, projectId, provider, region } = {}) {
    const clauses = [];
    const params = [];
    if (status) {
        clauses.push("p.status = ?");
        params.push(status);
    }
    if (from) {
        clauses.push("COALESCE(p.paid_at, p.created_at) >= ?");
        params.push(from);
    }
    if (to) {
        clauses.push("COALESCE(p.paid_at, p.created_at) < DATE_ADD(?, INTERVAL 1 DAY)");
        params.push(to);
    }
    if (projectId) {
        clauses.push("p.project_id = ?");
        params.push(projectId);
    }
    if (provider) {
        clauses.push("p.provider = ?");
        params.push(provider);
    }
    if (region) {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

exports.getAll = async (filters = {}) => {
    const { where, params } = buildFilters(filters);
    const [rows] = await db.query(
        `SELECT ${LIST_COLUMNS} ${LIST_FROM} ${where} ORDER BY p.created_at DESC LIMIT 2000`,
        params
    );
    return rows.map(mapPayment);
};

exports.getPendingOlderThan = async (minutes) => {
    const [rows] = await db.query(
        "SELECT id, provider, transaction_id, created_at FROM payments WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)",
        [minutes]
    );
    return rows;
};

exports.getSummary = async ({ year, region } = {}) => {
    const clauses = ["p.status = 'succeeded'"];
    const params = [];
    if (year) {
        clauses.push("YEAR(COALESCE(p.paid_at, p.created_at)) = ?");
        params.push(year);
    }
    if (region) {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    const where = `WHERE ${clauses.join(" AND ")}`;

    const [[totals]] = await db.query(
        `SELECT COALESCE(SUM(${EUR_SQL}), 0) AS total_eur, COUNT(*) AS count,
                COUNT(DISTINCT COALESCE(u.email, p.donor_email)) AS donors,
                COALESCE(AVG(${EUR_SQL}), 0) AS average_eur,
                COUNT(DISTINCT CASE WHEN p.frequency = 'monthly' THEN COALESCE(u.email, p.donor_email) END) AS recurring_donors
         ${LIST_FROM} ${where}`,
        params
    );
    const [byCurrency] = await db.query(
        `SELECT p.currency, COALESCE(SUM(p.amount), 0) AS amount, COUNT(*) AS count ${LIST_FROM} ${where} GROUP BY p.currency`,
        params
    );
    const [byProvider] = await db.query(
        `SELECT p.provider, p.method, COALESCE(SUM(${EUR_SQL}), 0) AS amount_eur, COUNT(*) AS count
         ${LIST_FROM} ${where} GROUP BY p.provider, p.method`,
        params
    );
    const [byProject] = await db.query(
        `SELECT p.project_id, COALESCE(pr.title, 'Fonds général') AS project_title,
                COALESCE(SUM(${EUR_SQL}), 0) AS amount_eur, COUNT(*) AS count
         ${LIST_FROM} ${where} GROUP BY p.project_id, pr.title ORDER BY amount_eur DESC`,
        params
    );
    const [byMonth] = await db.query(
        `SELECT DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m') AS month,
                COALESCE(SUM(${EUR_SQL}), 0) AS amount_eur, COUNT(*) AS count
         ${LIST_FROM} ${where} GROUP BY month ORDER BY month ASC`,
        params
    );
    const [[pending]] = await db.query(
        `SELECT COUNT(*) AS count FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id
         WHERE p.status = 'pending'${region ? " AND pr.region = ?" : ""}`,
        region ? [region] : []
    );

    const round = (value) => Math.round(Number(value) * 100) / 100;
    return {
        totalEur: round(totals.total_eur),
        count: Number(totals.count),
        donors: Number(totals.donors),
        averageEur: round(totals.average_eur),
        recurringDonors: Number(totals.recurring_donors),
        pendingCount: Number(pending.count),
        byCurrency: byCurrency.map((row) => ({ currency: row.currency, amount: round(row.amount), count: Number(row.count) })),
        byProvider: byProvider.map((row) => ({ provider: row.provider, method: row.method, amountEur: round(row.amount_eur), count: Number(row.count) })),
        byProject: byProject.map((row) => ({ projectId: row.project_id, title: row.project_title, amountEur: round(row.amount_eur), count: Number(row.count) })),
        byMonth: byMonth.map((row) => ({ month: row.month, amountEur: round(row.amount_eur), count: Number(row.count) })),
    };
};
