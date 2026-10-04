const db = require("../config/db");
const { DONOR_KEY_SQL, NET_EUR_SQL } = require("../utils/sql");

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
const RAISED_EUR_SQL = `COALESCE(SUM(${NET_EUR_SQL}), 0)`;

// Projet actif pendant l'annee : periode [debut, fin] qui recoupe l'annee. Sans date de debut,
// la date de creation fait foi ; sans date de fin, le projet est considere comme toujours actif.
const ACTIVE_IN_YEAR_SQL = "COALESCE(start_date, DATE(created_at)) <= ? AND (end_date IS NULL OR end_date >= ?)";
const activeInYearParams = (year) => [`${year}-12-31`, `${year}-01-01`];

exports.ACTIVE_IN_YEAR_SQL = ACTIVE_IN_YEAR_SQL;
exports.activeInYearParams = activeInYearParams;

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
           COUNT(DISTINCT ${DONOR_KEY_SQL}) AS donors_count
    FROM projects pr
    LEFT JOIN payments p ON p.project_id = pr.id AND p.status = 'succeeded'
    ${where}
    GROUP BY pr.id`;
}

exports.CONTENT_TYPES = Object.keys(CONTENT_TYPES);

// scopeRegion (administration, acteur restreint a sa region) : projets de la region, et
// actualites / temoignages rattaches a un projet de la region.
exports.getAll = async (type, { publishedOnly = false, region, scopeRegion } = {}) => {
    const { table } = resolve(type);
    const clauses = [];
    const params = [];
    const alias = type === "projects" ? "pr." : "";
    if (publishedOnly) clauses.push(`${alias}published = 1`);
    if (region && type === "projects") {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    if (scopeRegion) {
        clauses.push(type === "projects" ? "pr.region = ?" : "project_id IN (SELECT id FROM projects WHERE region = ?)");
        params.push(scopeRegion);
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

// Un champ absent ou undefined n'est jamais ecrit (evite d'ecraser une valeur par NULL).
function pickFields(fields, payload) {
    return fields.filter((field) => Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== undefined);
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

// Region du projet (undefined si le projet n'existe pas).
exports.getProjectRegion = async (id) => {
    const [rows] = await db.query("SELECT region FROM projects WHERE id = ?", [id]);
    return rows[0] ? rows[0].region : undefined;
};

exports.remove = async (type, id) => {
    const { table } = resolve(type);
    const [result] = await db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return result.affectedRows;
};

// Les compteurs d'impact (beneficiaries, trainees, credits_granted) sont des cumuls par projet,
// sans date. activeInYear restreint aux projets dont la periode recoupe l'annee : c'est la
// meilleure approximation honnete de l'impact d'une annee (et non un impact strictement annuel).
exports.getImpactTotals = async ({ region, activeInYear } = {}) => {
    const clauses = ["published = 1"];
    const params = [];
    if (region) {
        clauses.push("region = ?");
        params.push(region);
    }
    if (activeInYear) {
        clauses.push(ACTIVE_IN_YEAR_SQL);
        params.push(...activeInYearParams(activeInYear));
    }
    const [rows] = await db.query(
        `SELECT COUNT(*) AS projects,
                SUM(status = 'en_cours') AS active_projects,
                SUM(status = 'termine') AS completed_projects,
                COALESCE(SUM(beneficiaries), 0) AS beneficiaries,
                COALESCE(SUM(trainees), 0) AS trainees,
                COALESCE(SUM(credits_granted), 0) AS credits_granted,
                COUNT(DISTINCT region) AS regions_covered
         FROM projects WHERE ${clauses.join(" AND ")}`,
        params
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
