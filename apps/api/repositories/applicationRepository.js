const db = require("../config/db");

const OPEN_STATUSES_SQL = "status IN ('nouvelle', 'en_etude')";

function parseList(raw) {
    try {
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

// desired_roles : historique des anciennes candidatures (roles demandes, sans valeur de droit).
// interests : poles d'interet indicatifs (referentiel INTEREST_AREAS).
function mapApplication(row) {
    if (!row) return row;
    return { ...row, desired_roles: parseList(row.desired_roles), interests: parseList(row.interests) };
}

exports.create = async ({ name, email, phone, region, interests, motivation }) => {
    const [result] = await db.query(
        "INSERT INTO applications (name, email, phone, region, interests, motivation) VALUES (?, ?, ?, ?, ?, ?)",
        [name, email, phone || null, region || null, JSON.stringify(interests || []), motivation]
    );
    return result.insertId;
};

// Sans pagination : tableau complet. Avec { limit, offset } : { rows, total }.
exports.getAll = async ({ status } = {}, pagination = null) => {
    const where = status ? "WHERE a.status = ?" : "";
    const params = status ? [status] : [];
    const limit = pagination ? " LIMIT ? OFFSET ?" : "";
    const [rows] = await db.query(
        `SELECT a.*, r.name AS reviewer_name
         FROM applications a LEFT JOIN users r ON r.id = a.reviewer_id
         ${where} ORDER BY FIELD(a.status, 'nouvelle', 'en_etude', 'acceptee', 'refusee'), a.created_at DESC, a.id DESC${limit}`,
        pagination ? [...params, pagination.limit, pagination.offset] : params
    );
    if (!pagination) return rows.map(mapApplication);
    const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM applications a ${where}`, params);
    return { rows: rows.map(mapApplication), total: Number(count.total) };
};

exports.findById = async (id) => {
    const [rows] = await db.query("SELECT * FROM applications WHERE id = ?", [id]);
    return mapApplication(rows[0]);
};

exports.findOpenByEmail = async (email) => {
    const [rows] = await db.query(
        `SELECT id FROM applications WHERE email = ? AND ${OPEN_STATUSES_SQL}`,
        [email]
    );
    return rows[0];
};

// Mise a jour conditionnelle : ne s'applique qu'a une candidature encore ouverte, pour qu'une
// decision concurrente ne soit jamais ecrasee. Renvoie le nombre de lignes modifiees (0 ou 1).
// connection : connexion d'une transaction en cours (pool par defaut).
exports.updateReview = async (id, { status, reviewerId, reviewNote, userId }, connection = db) => {
    const [result] = await connection.query(
        `UPDATE applications
         SET status = ?, reviewer_id = ?, review_note = COALESCE(?, review_note), user_id = COALESCE(?, user_id)
         WHERE id = ? AND ${OPEN_STATUSES_SQL}`,
        [status, reviewerId, reviewNote ?? null, userId ?? null, id]
    );
    return result.affectedRows;
};

exports.countByStatus = async () => {
    const [rows] = await db.query("SELECT status, COUNT(*) AS total FROM applications GROUP BY status");
    return rows.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.total) }), {});
};
