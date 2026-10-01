const db = require("../config/db");

function mapApplication(row) {
    if (!row) return row;
    let desiredRoles = [];
    try {
        desiredRoles = row.desired_roles ? JSON.parse(row.desired_roles) : [];
    } catch (_error) {
        desiredRoles = [];
    }
    return { ...row, desired_roles: Array.isArray(desiredRoles) ? desiredRoles : [] };
}

exports.create = async ({ name, email, phone, region, desiredRoles, motivation }) => {
    const [result] = await db.query(
        "INSERT INTO applications (name, email, phone, region, desired_roles, motivation) VALUES (?, ?, ?, ?, ?, ?)",
        [name, email, phone || null, region || null, JSON.stringify(desiredRoles || []), motivation]
    );
    return result.insertId;
};

exports.getAll = async ({ status } = {}) => {
    const where = status ? "WHERE a.status = ?" : "";
    const [rows] = await db.query(
        `SELECT a.*, r.name AS reviewer_name
         FROM applications a LEFT JOIN users r ON r.id = a.reviewer_id
         ${where} ORDER BY FIELD(a.status, 'nouvelle', 'en_etude', 'acceptee', 'refusee'), a.created_at DESC`,
        status ? [status] : []
    );
    return rows.map(mapApplication);
};

exports.findById = async (id) => {
    const [rows] = await db.query("SELECT * FROM applications WHERE id = ?", [id]);
    return mapApplication(rows[0]);
};

exports.findOpenByEmail = async (email) => {
    const [rows] = await db.query(
        "SELECT id FROM applications WHERE email = ? AND status IN ('nouvelle', 'en_etude')",
        [email]
    );
    return rows[0];
};

exports.updateReview = async (id, { status, reviewerId, reviewNote, userId }) => {
    await db.query(
        `UPDATE applications
         SET status = ?, reviewer_id = ?, review_note = COALESCE(?, review_note), user_id = COALESCE(?, user_id)
         WHERE id = ?`,
        [status, reviewerId, reviewNote ?? null, userId ?? null, id]
    );
};

exports.countByStatus = async () => {
    const [rows] = await db.query("SELECT status, COUNT(*) AS total FROM applications GROUP BY status");
    return rows.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.total) }), {});
};
