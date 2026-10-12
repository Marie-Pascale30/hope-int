// Collectes personnelles (table fundraisers) : pages creees par les membres, moderees avant
// publication, avec le total des dons confirmes qui leur sont attribues.
const db = require("../config/db");
const { NET_AMOUNT_SQL } = require("../utils/sql");

// Total collecte dans la devise de la collecte (conversion a parite fixe pour l'autre devise).
const { XAF_PER_EUR } = require("@hope/shared/constants");

const RAISED_SQL = `(
  SELECT COALESCE(SUM(CASE
      WHEN p.currency = f.currency THEN ${NET_AMOUNT_SQL}
      WHEN f.currency = 'xaf' THEN ${NET_AMOUNT_SQL} * ${XAF_PER_EUR}
      ELSE ${NET_AMOUNT_SQL} / ${XAF_PER_EUR} END), 0)
  FROM payments p WHERE p.fundraiser_id = f.id AND p.status = 'succeeded')`;

const SUPPORTERS_SQL = "(SELECT COUNT(*) FROM payments p WHERE p.fundraiser_id = f.id AND p.status = 'succeeded')";

const COLUMNS = `
  f.id, f.user_id, f.project_id, f.slug, f.title, f.story, f.goal_amount, f.currency, f.ends_on, f.image_url,
  f.status, f.moderation_note, f.moderated_by, f.moderated_at, f.published_at, f.created_at, f.updated_at,
  u.name AS organizer_name, pr.title AS project_title, pr.status AS project_status, pr.region AS project_region,
  ${RAISED_SQL} AS raised, ${SUPPORTERS_SQL} AS supporters`;

const FROM = `
  FROM fundraisers f
  LEFT JOIN users u ON u.id = f.user_id
  LEFT JOIN projects pr ON pr.id = f.project_id`;

function map(row) {
    if (!row) return row;
    const raised = Number(row.raised || 0);
    return {
        ...row,
        goal_amount: Number(row.goal_amount),
        raised: row.currency === "xaf" ? Math.round(raised) : Math.round(raised * 100) / 100,
        supporters: Number(row.supporters || 0),
    };
}

exports.create = async (data) => {
    const [result] = await db.query(
        `INSERT INTO fundraisers (user_id, project_id, slug, title, story, goal_amount, currency, ends_on, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.userId, data.projectId, data.slug, data.title, data.story, data.goalAmount, data.currency, data.endsOn || null, data.imageUrl || null]
    );
    return result.insertId;
};

exports.slugExists = async (slug) => {
    const [rows] = await db.query("SELECT 1 FROM fundraisers WHERE slug = ?", [slug]);
    return rows.length > 0;
};

exports.findById = async (id) => {
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE f.id = ?`, [id]);
    return map(rows[0]);
};

exports.findBySlug = async (slug) => {
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE f.slug = ?`, [slug]);
    return map(rows[0]);
};

exports.getByUser = async (userId) => {
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE f.user_id = ? ORDER BY f.created_at DESC, f.id DESC`, [userId]);
    return rows.map(map);
};

exports.getAll = async ({ status } = {}) => {
    const params = [];
    let where = "";
    if (status) {
        where = "WHERE f.status = ?";
        params.push(status);
    }
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} ${where} ORDER BY f.created_at DESC, f.id DESC LIMIT 500`, params);
    return rows.map(map);
};

exports.getPublished = async ({ projectId, limit = 50 } = {}) => {
    const params = [];
    let extra = "";
    if (projectId) {
        extra = "AND f.project_id = ?";
        params.push(projectId);
    }
    const [rows] = await db.query(
        `SELECT ${COLUMNS} ${FROM} WHERE f.status = 'published' ${extra} ORDER BY f.published_at DESC, f.id DESC LIMIT ?`,
        [...params, limit]
    );
    return rows.map(map);
};

exports.update = async (id, changes) => {
    const fields = {
        title: "title", story: "story", goalAmount: "goal_amount", currency: "currency", endsOn: "ends_on",
        imageUrl: "image_url", projectId: "project_id", status: "status",
    };
    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(fields)) {
        if (changes[key] !== undefined) {
            sets.push(`${column} = ?`);
            params.push(changes[key]);
        }
    }
    if (!sets.length) return false;
    const [result] = await db.query(`UPDATE fundraisers SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
    return result.affectedRows > 0;
};

// Decision de moderation atomique (seulement depuis "pending").
exports.moderate = async (id, { status, note, moderatorId }) => {
    const [result] = await db.query(
        `UPDATE fundraisers SET status = ?, moderation_note = ?, moderated_by = ?, moderated_at = NOW(),
           published_at = IF(? = 'published', COALESCE(published_at, NOW()), published_at)
         WHERE id = ? AND status = 'pending'`,
        [status, note || null, moderatorId, status, id]
    );
    return result.affectedRows > 0;
};

// Derniers soutiens confirmes : nom affichable (sauf anonymat demande), montant non expose.
exports.getRecentSupporters = async (fundraiserId, limit = 10) => {
    const [rows] = await db.query(
        `SELECT p.id, p.public_anonymous, COALESCE(NULLIF(p.donor_name, ''), u.name) AS donor_name,
                COALESCE(p.paid_at, p.created_at) AS paid_at
         FROM payments p LEFT JOIN users u ON u.id = p.user_id
         WHERE p.fundraiser_id = ? AND p.status = 'succeeded'
         ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC LIMIT ?`,
        [fundraiserId, limit]
    );
    return rows;
};
