const db = require("../config/db");

exports.create = async ({ userId = null, action, meta = null }) => {
    await db.query(
        "INSERT INTO activity_logs (user_id, action, meta) VALUES (?, ?, ?)",
        [userId, action, meta ? JSON.stringify(meta) : null]
    );
};

exports.getLatest = async ({ limit = 100, offset = 0, action, userId } = {}) => {
    const clauses = [];
    const params = [];
    if (action) {
        clauses.push("l.action LIKE ?");
        params.push(`${action}%`);
    }
    if (userId) {
        clauses.push("l.user_id = ?");
        params.push(userId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await db.query(
        `SELECT l.id, l.user_id, l.action, l.meta, l.created_at, u.name AS user_name, u.email AS user_email
         FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
         ${where} ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`,
        [...params, Number(limit), Number(offset)]
    );
    const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM activity_logs l ${where}`, params);
    return { items: rows, total: Number(count.total) };
};
