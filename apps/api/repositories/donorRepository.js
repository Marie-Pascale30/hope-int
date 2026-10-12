const db = require("../config/db");
const { XAF_PER_EUR, SUCCESS_PAYMENT_STATUSES } = require("@hope/shared/constants");

// CRM donateurs : agregats calcules a la lecture sur les dons confirmes (pas de table copiee).
// Cle d'un donateur : "u:<id>" si le don est rattache a un compte, sinon "e:<email>".

const STATUS_LIST = SUCCESS_PAYMENT_STATUSES.map((status) => db.escape(status)).join(", ");
const KEY_SQL = "CASE WHEN p.user_id IS NOT NULL THEN CONCAT('u:', p.user_id) ELSE CONCAT('e:', LOWER(p.donor_email)) END";
const NET_SQL = "(p.amount - COALESCE(p.refunded_amount, 0))";
const EUR_SQL = `CASE WHEN LOWER(p.currency) = 'xaf' THEN ${NET_SQL} / ${XAF_PER_EUR} ELSE ${NET_SQL} END`;

// Une ligne par donateur.
const AGGREGATE_SQL = `
  SELECT ${KEY_SQL} AS donor_key,
         MAX(p.user_id) AS user_id,
         COALESCE(MAX(u.name), MAX(p.donor_name)) AS name,
         COALESCE(MAX(u.email), LOWER(MAX(p.donor_email))) AS email,
         MAX(u.region) AS region,
         COUNT(*) AS donations,
         ROUND(SUM(${EUR_SQL}), 2) AS total_eur,
         ROUND(SUM(CASE WHEN LOWER(p.currency) = 'eur' THEN ${NET_SQL} ELSE 0 END), 2) AS total_eur_native,
         ROUND(SUM(CASE WHEN LOWER(p.currency) = 'xaf' THEN ${NET_SQL} ELSE 0 END), 0) AS total_xaf,
         IF(SUM(LOWER(p.currency) = 'xaf') > SUM(LOWER(p.currency) = 'eur'), 'xaf', 'eur') AS main_currency,
         MIN(COALESCE(p.paid_at, p.created_at)) AS first_donation_at,
         MAX(COALESCE(p.paid_at, p.created_at)) AS last_donation_at,
         MAX(p.frequency = 'monthly' AND p.subscription_id IS NOT NULL
             AND COALESCE(p.subscription_status, 'active') IN ('active', 'trialing', 'past_due')) AS recurring
  FROM payments p
  LEFT JOIN users u ON u.id = p.user_id
  WHERE p.status IN (${STATUS_LIST}) AND (p.user_id IS NOT NULL OR p.donor_email IS NOT NULL)
  GROUP BY donor_key`;

function segmentClauses({ segment, region, q, tag, threshold, inactiveMonths }) {
    const clauses = [];
    const params = [];
    if (segment === "recurring") clauses.push("d.recurring = 1");
    if (segment === "inactive") {
        clauses.push("d.last_donation_at < DATE_SUB(NOW(), INTERVAL ? MONTH)");
        params.push(inactiveMonths);
    }
    if (segment === "diaspora_eur") clauses.push("d.main_currency = 'eur'");
    if (segment === "major") {
        clauses.push("d.total_eur >= ?");
        params.push(threshold);
    }
    if (region) {
        clauses.push("d.region = ?");
        params.push(region);
    }
    if (q) {
        const pattern = `%${String(q).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
        clauses.push("(d.name LIKE ? OR d.email LIKE ?)");
        params.push(pattern, pattern);
    }
    if (tag) {
        clauses.push("EXISTS (SELECT 1 FROM donor_tags t WHERE t.donor_key = d.donor_key AND t.tag = ?)");
        params.push(tag);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

const SORTS = {
    total: "d.total_eur DESC",
    last: "d.last_donation_at DESC",
    first: "d.first_donation_at ASC",
    name: "d.name ASC",
    donations: "d.donations DESC",
};

function mapDonor(row) {
    return {
        ...row,
        user_id: row.user_id ? Number(row.user_id) : null,
        donations: Number(row.donations),
        total_eur: Number(row.total_eur),
        total_eur_native: Number(row.total_eur_native),
        total_xaf: Number(row.total_xaf),
        recurring: Boolean(Number(row.recurring)),
    };
}

// filters : { segment, region, q, tag, threshold, inactiveMonths } ; pagination : { limit, offset } (facultative).
exports.list = async (filters, { limit, offset, sort = "total" } = {}) => {
    const { where, params } = segmentClauses(filters);
    const order = SORTS[sort] || SORTS.total;
    const paging = limit ? " LIMIT ? OFFSET ?" : "";
    const [rows] = await db.query(
        `SELECT d.*, (SELECT GROUP_CONCAT(t.tag ORDER BY t.tag SEPARATOR ',') FROM donor_tags t WHERE t.donor_key = d.donor_key) AS tags
         FROM (${AGGREGATE_SQL}) d ${where} ORDER BY ${order}, d.donor_key ASC${paging}`,
        limit ? [...params, Number(limit), Number(offset || 0)] : params
    );
    const [[count]] = await db.query(`SELECT COUNT(*) AS total, ROUND(SUM(d.total_eur), 2) AS amount FROM (${AGGREGATE_SQL}) d ${where}`, params);
    return {
        items: rows.map((row) => ({ ...mapDonor(row), tags: row.tags ? row.tags.split(",") : [] })),
        total: Number(count.total),
        totalEur: Number(count.amount || 0),
    };
};

exports.findByKey = async (key) => {
    const [rows] = await db.query(`SELECT d.* FROM (${AGGREGATE_SQL}) d WHERE d.donor_key = ?`, [key]);
    return rows[0] ? mapDonor(rows[0]) : null;
};

// Historique des dons (tous statuts) d'un donateur.
exports.donationsFor = async ({ userId, email }) => {
    const [rows] = await db.query(
        `SELECT p.id, p.amount, p.currency, p.status, p.method, p.provider, p.frequency, p.refunded_amount,
                p.receipt_number, p.paid_at, p.created_at, pr.id AS project_id, pr.title AS project_title
         FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id
         WHERE ${userId ? "p.user_id = ?" : "p.user_id IS NULL AND LOWER(p.donor_email) = ?"}
         ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC LIMIT 500`,
        [userId || email]
    );
    return rows;
};

exports.eventsFor = async (userId) => {
    if (!userId) return [];
    const [rows] = await db.query(
        `SELECT e.id, e.title, e.start_at, e.location, r.created_at AS registered_at
         FROM event_registrations r JOIN events e ON e.id = r.event_id
         WHERE r.user_id = ? ORDER BY e.start_at DESC LIMIT 100`,
        [userId]
    );
    return rows;
};

exports.notesFor = async (key) => {
    const [rows] = await db.query(
        `SELECT n.id, n.body, n.created_at, n.author_id, u.name AS author_name
         FROM donor_notes n LEFT JOIN users u ON u.id = n.author_id
         WHERE n.donor_key = ? ORDER BY n.created_at DESC, n.id DESC`,
        [key]
    );
    return rows;
};

exports.addNote = async (key, authorId, body) => {
    const [result] = await db.query("INSERT INTO donor_notes (donor_key, author_id, body) VALUES (?, ?, ?)", [key, authorId, body]);
    return result.insertId;
};

exports.removeNote = async (key, id) => {
    const [result] = await db.query("DELETE FROM donor_notes WHERE id = ? AND donor_key = ?", [id, key]);
    return result.affectedRows > 0;
};

exports.tagsFor = async (key) => {
    const [rows] = await db.query("SELECT tag FROM donor_tags WHERE donor_key = ? ORDER BY tag", [key]);
    return rows.map((row) => row.tag);
};

exports.replaceTags = async (key, tags) => {
    await db.query("DELETE FROM donor_tags WHERE donor_key = ?", [key]);
    if (!tags.length) return;
    await db.query(
        `INSERT INTO donor_tags (donor_key, tag) VALUES ${tags.map(() => "(?, ?)").join(", ")}`,
        tags.flatMap((tag) => [key, tag])
    );
};

exports.allTags = async () => {
    const [rows] = await db.query("SELECT tag, COUNT(*) AS total FROM donor_tags GROUP BY tag ORDER BY tag");
    return rows.map((row) => ({ tag: row.tag, count: Number(row.total) }));
};

// Donateurs (emails) d'un projet, pour les nouvelles des projets.
exports.projectDonors = async (projectId) => {
    const [rows] = await db.query(
        `SELECT LOWER(COALESCE(u.email, p.donor_email)) AS email, COALESCE(MAX(u.name), MAX(p.donor_name)) AS name
         FROM payments p LEFT JOIN users u ON u.id = p.user_id
         WHERE p.project_id = ? AND p.status IN (${STATUS_LIST}) AND COALESCE(u.email, p.donor_email) IS NOT NULL
           AND (u.id IS NULL OR (u.status = 'active' AND u.anonymized_at IS NULL))
         GROUP BY LOWER(COALESCE(u.email, p.donor_email))
         ORDER BY email`,
        [projectId]
    );
    return rows;
};
