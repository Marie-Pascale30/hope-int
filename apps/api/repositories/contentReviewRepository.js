// Workflow de validation des contenus : statut de relecture (colonnes review_* des tables
// projects / news / testimonials), file "a valider" et historique des decisions (content_reviews).
const db = require("../config/db");

const TABLES = { projects: "projects", news: "news", testimonials: "testimonials" };

function table(type) {
    const name = TABLES[type];
    if (!name) throw new Error("Type de contenu invalide");
    return name;
}

const REVIEW_FIELDS = ["review_status", "review_comment", "submitted_by", "submitted_at", "reviewed_by", "reviewed_at", "published"];

// Ecrit les champs de relecture fournis (et published le cas echeant).
exports.setReview = async (type, id, fields, connection = db) => {
    const present = REVIEW_FIELDS.filter((field) => fields[field] !== undefined);
    if (!present.length) return;
    await connection.query(
        `UPDATE ${table(type)} SET ${present.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`,
        [...present.map((field) => fields[field]), id]
    );
};

// Contenu verrouille le temps d'une decision (deux relecteurs simultanes).
exports.lockItem = async (connection, type, id) => {
    const [[row]] = await connection.query(
        `SELECT id, published, review_status, submitted_by FROM ${table(type)} WHERE id = ? FOR UPDATE`,
        [id]
    );
    return row || null;
};

exports.addHistory = async ({ type, id, action, actorId, comment = null }, connection = db) => {
    await connection.query(
        "INSERT INTO content_reviews (content_type, content_id, action, actor_id, comment) VALUES (?, ?, ?, ?, ?)",
        [type, id, action, actorId, comment]
    );
};

exports.getHistory = async (type, id) => {
    const [rows] = await db.query(
        `SELECT c.id, c.action, c.comment, c.created_at, u.name AS actor_name
         FROM content_reviews c LEFT JOIN users u ON u.id = c.actor_id
         WHERE c.content_type = ? AND c.content_id = ?
         ORDER BY c.id DESC LIMIT 50`,
        [type, id]
    );
    return rows;
};

// File de validation : contenus d'un statut donne, tous types confondus, plus anciens d'abord.
exports.getQueue = async ({ status = "submitted" } = {}) => {
    const [rows] = await db.query(
        `SELECT q.*, u.name AS submitted_by_name FROM (
           SELECT 'projects' AS type, p.id, p.title, p.summary, p.description AS body, p.image_url, p.region,
                  p.review_status, p.review_comment, p.submitted_by, p.submitted_at, p.created_at
           FROM projects p WHERE p.review_status = ?
           UNION ALL
           SELECT 'news', n.id, n.title, n.summary, n.content, n.image_url, pr.region,
                  n.review_status, n.review_comment, n.submitted_by, n.submitted_at, n.created_at
           FROM news n LEFT JOIN projects pr ON pr.id = n.project_id WHERE n.review_status = ?
           UNION ALL
           SELECT 'testimonials', t.id, t.author, t.role_label, t.content, t.image_url, pr.region,
                  t.review_status, t.review_comment, t.submitted_by, t.submitted_at, t.created_at
           FROM testimonials t LEFT JOIN projects pr ON pr.id = t.project_id WHERE t.review_status = ?
         ) q LEFT JOIN users u ON u.id = q.submitted_by
         ORDER BY COALESCE(q.submitted_at, q.created_at) ASC, q.id ASC
         LIMIT 500`,
        [status, status, status]
    );
    return rows;
};

exports.countSubmitted = async () => {
    const [[row]] = await db.query(
        `SELECT (SELECT COUNT(*) FROM projects WHERE review_status = 'submitted')
              + (SELECT COUNT(*) FROM news WHERE review_status = 'submitted')
              + (SELECT COUNT(*) FROM testimonials WHERE review_status = 'submitted') AS total`
    );
    return Number(row.total);
};

exports.findUser = async (id) => {
    const [rows] = await db.query("SELECT id, name, email FROM users WHERE id = ?", [id]);
    return rows[0] || null;
};
