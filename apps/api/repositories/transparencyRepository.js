// Transparence : publication annuelle, documents publics, agregats publics (recettes, regions)
// et portraits de l'equipe. Aucune donnee personnelle de donateur ne sort de ces requetes.
const db = require("../config/db");
const { NET_EUR_SQL } = require("../utils/sql");
const { yearBounds } = require("../utils/timezone");

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

// ---------- Publication des annees ----------

exports.listYears = async () => {
    const [rows] = await db.query(
        `SELECT t.year, t.published, t.note, t.published_at, t.updated_at, u.name AS published_by_name
         FROM transparency_years t LEFT JOIN users u ON u.id = t.published_by ORDER BY t.year DESC`
    );
    return rows.map((row) => ({ ...row, year: Number(row.year), published: Boolean(row.published) }));
};

exports.getYear = async (year) => {
    const [rows] = await db.query("SELECT year, published, note, published_at FROM transparency_years WHERE year = ?", [year]);
    const row = rows[0];
    return row ? { ...row, year: Number(row.year), published: Boolean(row.published) } : null;
};

exports.publishedYears = async () => {
    const [rows] = await db.query("SELECT year FROM transparency_years WHERE published = 1 ORDER BY year DESC");
    return rows.map((row) => Number(row.year));
};

exports.setYear = async (year, { published, note, userId }) => {
    await db.query(
        `INSERT INTO transparency_years (year, published, note, published_at, published_by)
         VALUES (?, ?, ?, ${published ? "NOW()" : "NULL"}, ?)
         ON DUPLICATE KEY UPDATE
           published = VALUES(published),
           note = VALUES(note),
           published_at = ${published ? "COALESCE(published_at, NOW())" : "NULL"},
           published_by = VALUES(published_by)`,
        [year, published ? 1 : 0, note || null, userId || null]
    );
};

// Annees pour lesquelles il existe une activite (dons, depenses) : propositions de publication.
exports.activityYears = async () => {
    const [rows] = await db.query(
        `SELECT DISTINCT y FROM (
           SELECT YEAR(paid_at) AS y FROM payments WHERE status = 'succeeded' AND paid_at IS NOT NULL
           UNION SELECT YEAR(spent_on) FROM expenses
           UNION SELECT year FROM transparency_years
         ) years WHERE y IS NOT NULL ORDER BY y DESC`
    );
    return rows.map((row) => Number(row.y));
};

// ---------- Documents publics ----------

function mapDocument(row) {
    return row ? { ...row, year: Number(row.year), file_size: Number(row.file_size) } : row;
}

exports.listDocuments = async ({ year, publishedOnly = false } = {}) => {
    const clauses = [];
    const params = [];
    if (year) {
        clauses.push("d.year = ?");
        params.push(year);
    }
    // Public : seulement les documents des annees publiees.
    if (publishedOnly) clauses.push("d.year IN (SELECT year FROM transparency_years WHERE published = 1)");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const [rows] = await db.query(
        `SELECT d.id, d.title, d.year, d.kind, d.file_url, d.file_size, d.created_at
         FROM public_documents d ${where} ORDER BY d.year DESC, d.created_at DESC, d.id DESC`,
        params
    );
    return rows.map(mapDocument);
};

exports.findDocument = async (id) => {
    const [rows] = await db.query("SELECT * FROM public_documents WHERE id = ?", [id]);
    return mapDocument(rows[0]);
};

exports.createDocument = async ({ title, year, kind, fileUrl, fileSize, userId }) => {
    const [result] = await db.query(
        "INSERT INTO public_documents (title, year, kind, file_url, file_size, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        [title, year, kind, fileUrl, fileSize || 0, userId || null]
    );
    return result.insertId;
};

exports.removeDocument = async (id) => {
    const [result] = await db.query("DELETE FROM public_documents WHERE id = ?", [id]);
    return result.affectedRows;
};

// ---------- Recettes (dons confirmes, nets des remboursements) ----------

const PAYMENTS_FROM = "FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id";

// Bornes : annee civile du fuseau des recus, ou periode [from, to[ explicite. projectId : un projet.
function revenueWhere({ year, from, to, projectId } = {}) {
    const bounds = year ? yearBounds(Number(year)) : { from, to };
    const clauses = ["p.status = 'succeeded'"];
    const params = [];
    if (bounds.from) {
        clauses.push("p.paid_at >= ?");
        params.push(bounds.from);
    }
    if (bounds.to) {
        clauses.push("p.paid_at < ?");
        params.push(bounds.to);
    }
    if (projectId) {
        clauses.push("p.project_id = ?");
        params.push(projectId);
    }
    return { sql: `WHERE ${clauses.join(" AND ")}`, params };
}

exports.revenueTotals = async (filters) => {
    const where = revenueWhere(filters);
    const [[row]] = await db.query(
        `SELECT COALESCE(SUM(${NET_EUR_SQL}), 0) AS total_eur, COUNT(*) AS count ${PAYMENTS_FROM} ${where.sql}`,
        where.params
    );
    return { totalEur: round(row.total_eur), count: Number(row.count) };
};

exports.revenueByMethod = async (filters) => {
    const where = revenueWhere(filters);
    const [rows] = await db.query(
        `SELECT p.method, COALESCE(SUM(${NET_EUR_SQL}), 0) AS amount_eur, COUNT(*) AS count
         ${PAYMENTS_FROM} ${where.sql} GROUP BY p.method ORDER BY amount_eur DESC`,
        where.params
    );
    return rows.map((row) => ({ method: row.method || "other", amountEur: round(row.amount_eur), count: Number(row.count) }));
};

exports.revenueByProject = async (filters) => {
    const where = revenueWhere(filters);
    const [rows] = await db.query(
        `SELECT p.project_id, pr.title AS project_title, pr.published AS project_published,
                COALESCE(SUM(${NET_EUR_SQL}), 0) AS amount_eur
         ${PAYMENTS_FROM} ${where.sql} GROUP BY p.project_id, pr.title, pr.published ORDER BY amount_eur DESC`,
        where.params
    );
    return rows.map((row) => ({
        projectId: row.project_id === null ? null : Number(row.project_id),
        title: row.project_title,
        published: Boolean(row.project_published),
        amountEur: round(row.amount_eur),
    }));
};

// ---------- Carte des regions ----------

// Projets publies (dont en cours) et evenements publies a venir, par region.
exports.regionCounts = async () => {
    const [projects] = await db.query(
        `SELECT region, COUNT(*) AS projects, SUM(status = 'en_cours') AS active,
                COALESCE(SUM(beneficiaries), 0) AS beneficiaries
         FROM projects WHERE published = 1 AND region IS NOT NULL GROUP BY region`
    );
    const [events] = await db.query(
        `SELECT region, COUNT(*) AS events FROM events
         WHERE published = 1 AND region IS NOT NULL AND COALESCE(end_at, start_at) >= NOW()
         GROUP BY region`
    );
    return { projects, events };
};

// ---------- Equipe ----------

const TEAM_COLUMNS = "id, name, roles, role, region, public_profile, public_consent_at, public_title, public_bio, public_photo_url";

exports.listPublicTeam = async () => {
    const [rows] = await db.query(
        `SELECT ${TEAM_COLUMNS} FROM users WHERE public_profile = 1 AND status = 'active' ORDER BY name`
    );
    return rows;
};

// Fiches de l'administration : comptes actifs (portrait publie ou non).
exports.listTeamProfiles = async ({ region } = {}) => {
    const [rows] = await db.query(
        `SELECT ${TEAM_COLUMNS}, email FROM users WHERE status = 'active'${region ? " AND region = ?" : ""} ORDER BY name`,
        region ? [region] : []
    );
    return rows;
};

exports.findTeamProfile = async (userId) => {
    const [rows] = await db.query(`SELECT ${TEAM_COLUMNS}, status FROM users WHERE id = ?`, [userId]);
    return rows[0] || null;
};

exports.updateTeamProfile = async (userId, { publicProfile, title, bio, photoUrl }) => {
    const fields = { public_title: title || null, public_bio: bio || null };
    if (photoUrl !== undefined) fields.public_photo_url = photoUrl;
    if (publicProfile !== undefined) fields.public_profile = publicProfile ? 1 : 0;
    const columns = Object.keys(fields);
    // Date du consentement : posee a l'activation, effacee au retrait.
    const consent = publicProfile === undefined
        ? ""
        : publicProfile
            ? ", public_consent_at = COALESCE(public_consent_at, NOW())"
            : ", public_consent_at = NULL";
    await db.query(
        `UPDATE users SET ${columns.map((column) => `${column} = ?`).join(", ")}${consent} WHERE id = ?`,
        [...columns.map((column) => fields[column]), userId]
    );
};
