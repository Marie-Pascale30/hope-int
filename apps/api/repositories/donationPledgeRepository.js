// Engagements de don mensuel par Mobile Money (table donation_pledges) et rappels envoyes.
const db = require("../config/db");

const COLUMNS = `
  d.id, d.user_id, d.donor_name, d.donor_email, d.amount, d.currency, d.day_of_month, d.project_id,
  d.channel, d.status, d.pay_ref, d.last_reminder_period, d.last_reminder_at, d.stopped_at,
  d.created_at, d.updated_at, pr.title AS project_title, pr.region AS project_region`;

const FROM = "FROM donation_pledges d LEFT JOIN projects pr ON pr.id = d.project_id";

const map = (row) => (row ? { ...row, amount: Number(row.amount), day_of_month: Number(row.day_of_month) } : row);

exports.create = async (data) => {
    const [result] = await db.query(
        `INSERT INTO donation_pledges
           (user_id, donor_name, donor_email, amount, currency, day_of_month, project_id, channel, manage_token_hash, pay_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.userId || null,
            data.donorName,
            data.donorEmail,
            data.amount,
            data.currency || "xaf",
            data.dayOfMonth,
            data.projectId || null,
            data.channel || "email",
            data.manageTokenHash,
            data.payRef,
        ]
    );
    return result.insertId;
};

exports.findById = async (id) => {
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE d.id = ?`, [id]);
    return map(rows[0]);
};

exports.findByTokenHash = async (hash) => {
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE d.manage_token_hash = ?`, [hash]);
    return map(rows[0]);
};

exports.findByPayRef = async (payRef) => {
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE d.pay_ref = ?`, [payRef]);
    return map(rows[0]);
};

exports.getByUser = async (userId) => {
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE d.user_id = ? ORDER BY d.created_at DESC, d.id DESC`, [userId]);
    return rows.map(map);
};

exports.getAll = async ({ status, region } = {}) => {
    const clauses = [];
    const params = [];
    if (status) {
        clauses.push("d.status = ?");
        params.push(status);
    }
    if (region) {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} ${where} ORDER BY d.created_at DESC, d.id DESC LIMIT 500`, params);
    return rows.map(map);
};

// Mise a jour partielle (montant, jour, projet, statut) ; un engagement arrete ne repart jamais.
exports.update = async (id, changes) => {
    const sets = [];
    const params = [];
    const fields = { amount: "amount", dayOfMonth: "day_of_month", projectId: "project_id", status: "status" };
    for (const [key, column] of Object.entries(fields)) {
        if (changes[key] !== undefined) {
            sets.push(`${column} = ?`);
            params.push(changes[key]);
        }
    }
    if (changes.status === "stopped") sets.push("stopped_at = COALESCE(stopped_at, NOW())");
    if (!sets.length) return false;
    const [result] = await db.query(
        `UPDATE donation_pledges SET ${sets.join(", ")} WHERE id = ? AND status <> 'stopped'`,
        [...params, id]
    );
    return result.affectedRows > 0;
};

// Engagements actifs dont le jour de rappel est atteint et non encore rappeles ce mois-ci.
exports.getDue = async ({ period, day, limit }) => {
    const [rows] = await db.query(
        `SELECT ${COLUMNS} ${FROM}
         WHERE d.status = 'active' AND d.day_of_month <= ?
           AND (d.last_reminder_period IS NULL OR d.last_reminder_period < ?)
           AND DATE_FORMAT(d.created_at, '%Y-%m') <= ?
         ORDER BY d.id ASC LIMIT ?`,
        [day, period, period, limit]
    );
    return rows.map(map);
};

// Reservation atomique du rappel du mois (une seule instance l'envoie).
exports.claimReminder = async (pledgeId, period) => {
    const [result] = await db.query(
        `UPDATE donation_pledges SET last_reminder_period = ?, last_reminder_at = NOW()
         WHERE id = ? AND status = 'active' AND (last_reminder_period IS NULL OR last_reminder_period < ?)`,
        [period, pledgeId, period]
    );
    if (!result.affectedRows) return false;
    await db.query("INSERT IGNORE INTO donation_pledge_reminders (pledge_id, period) VALUES (?, ?)", [pledgeId, period]);
    return true;
};

exports.getReminderPeriods = async (pledgeIds) => {
    if (!pledgeIds.length) return [];
    const [rows] = await db.query(
        "SELECT pledge_id, period, sent_at FROM donation_pledge_reminders WHERE pledge_id IN (?) ORDER BY period ASC",
        [pledgeIds]
    );
    return rows;
};

// Dons confirmes rattaches aux engagements (date de paiement, pour le suivi de regularite).
exports.getPaidDonations = async (pledgeIds) => {
    if (!pledgeIds.length) return [];
    const [rows] = await db.query(
        `SELECT id, pledge_id, amount, currency, COALESCE(paid_at, created_at) AS paid_at
         FROM payments WHERE pledge_id IN (?) AND status = 'succeeded' ORDER BY paid_at ASC`,
        [pledgeIds]
    );
    return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
};
