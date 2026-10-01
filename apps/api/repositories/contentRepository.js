const db = require("../config/db");
const { XAF_PER_EUR } = require("@hope/shared/constants");

const CONTENT_TYPES = {
    projects: {
        table: "projects",
        fields: [
            "title", "summary", "description", "image_url", "status", "region", "start_date", "end_date",
            "budget", "goal_amount", "beneficiaries", "trainees", "credits_granted", "published",
        ],
    },
    testimonials: {
        table: "testimonials",
        fields: ["author", "role_label", "content", "image_url", "project_id", "published"],
    },
    news: {
        table: "news",
        fields: ["title", "summary", "content", "image_url", "project_id", "published"],
    },
};

// Montant collecte converti en EUR (le XAF a une parite fixe).
const RAISED_EUR_SQL = `COALESCE(SUM(CASE WHEN p.currency = 'xaf' THEN p.amount / ${XAF_PER_EUR} ELSE p.amount END), 0)`;

function resolve(type) {
    const config = CONTENT_TYPES[type];
    if (!config) {
        throw new Error("Type de contenu invalide");
    }
    return config;
}

function mapProject(row) {
    if (!row) return row;
    const goal = row.goal_amount === null ? null : Number(row.goal_amount);
    const raised = Number(row.raised_eur || 0);
    return {
        ...row,
        published: Boolean(row.published),
        budget: row.budget === null ? null : Number(row.budget),
        goal_amount: goal,
        raised_eur: Math.round(raised * 100) / 100,
        donors_count: Number(row.donors_count || 0),
        progress: goal ? Math.min(100, Math.round((raised / goal) * 100)) : null,
    };
}

function mapRow(type, row) {
    if (!row) return row;
    if (type === "projects") return mapProject(row);
    return { ...row, published: Boolean(row.published) };
}

function projectSelect(where = "") {
    return `
    SELECT pr.*, ${RAISED_EUR_SQL} AS raised_eur,
           COUNT(DISTINCT COALESCE(p.donor_email, CONCAT('user:', p.user_id))) AS donors_count
    FROM projects pr
    LEFT JOIN payments p ON p.project_id = pr.id AND p.status = 'succeeded'
    ${where}
    GROUP BY pr.id`;
}

exports.CONTENT_TYPES = Object.keys(CONTENT_TYPES);

exports.getAll = async (type, { publishedOnly = false, region } = {}) => {
    const { table } = resolve(type);
    const clauses = [];
    const params = [];
    const alias = type === "projects" ? "pr." : "";
    if (publishedOnly) clauses.push(`${alias}published = 1`);
    if (region && type === "projects") {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const sql = type === "projects"
        ? `${projectSelect(where)} ORDER BY FIELD(pr.status, 'en_cours', 'planifie', 'termine'), pr.created_at DESC, pr.id ASC`
        : `SELECT * FROM ${table} ${where} ORDER BY created_at DESC, id DESC`;
    const [rows] = await db.query(sql, params);
    return rows.map((row) => mapRow(type, row));
};

exports.getById = async (type, id, { publishedOnly = false } = {}) => {
    const { table } = resolve(type);
    const alias = type === "projects" ? "pr." : "";
    const where = `WHERE ${alias}id = ?${publishedOnly ? ` AND ${alias}published = 1` : ""}`;
    const sql = type === "projects" ? projectSelect(where) : `SELECT * FROM ${table} ${where}`;
    const [rows] = await db.query(sql, [id]);
    return mapRow(type, rows[0]);
};

function pickFields(fields, payload) {
    return fields.filter((field) => Object.prototype.hasOwnProperty.call(payload, field));
}

exports.create = async (type, payload) => {
    const { table, fields } = resolve(type);
    const present = pickFields(fields, payload);
    const placeholders = present.map(() => "?").join(", ");
    const [result] = await db.query(
        `INSERT INTO ${table} (${present.join(", ")}) VALUES (${placeholders})`,
        present.map((field) => payload[field])
    );
    return result.insertId;
};

exports.update = async (type, id, payload) => {
    const { table, fields } = resolve(type);
    const present = pickFields(fields, payload);
    if (!present.length) return;
    await db.query(
        `UPDATE ${table} SET ${present.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
        [...present.map((field) => payload[field]), id]
    );
};

exports.remove = async (type, id) => {
    const { table } = resolve(type);
    const [result] = await db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return result.affectedRows;
};

exports.getImpactTotals = async ({ region } = {}) => {
    const where = region ? "AND region = ?" : "";
    const [rows] = await db.query(
        `SELECT COUNT(*) AS projects,
                SUM(status = 'en_cours') AS active_projects,
                SUM(status = 'termine') AS completed_projects,
                COALESCE(SUM(beneficiaries), 0) AS beneficiaries,
                COALESCE(SUM(trainees), 0) AS trainees,
                COALESCE(SUM(credits_granted), 0) AS credits_granted,
                COUNT(DISTINCT region) AS regions_covered
         FROM projects WHERE published = 1 ${where}`,
        region ? [region] : []
    );
    const row = rows[0] || {};
    return {
        projects: Number(row.projects || 0),
        activeProjects: Number(row.active_projects || 0),
        completedProjects: Number(row.completed_projects || 0),
        beneficiaries: Number(row.beneficiaries || 0),
        trainees: Number(row.trainees || 0),
        creditsGranted: Number(row.credits_granted || 0),
        regionsCovered: Number(row.regions_covered || 0),
    };
};
