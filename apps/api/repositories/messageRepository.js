const db = require("../config/db");

exports.create = async ({ name, email, subject, content }) => {
    const [result] = await db.query(
        "INSERT INTO messages (name, email, subject, content, message_type) VALUES (?, ?, ?, ?, 'general')",
        [name, email, subject, content]
    );
    return result.insertId;
};

exports.getAll = async ({ status } = {}) => {
    const where = status ? "WHERE m.status = ?" : "";
    const [rows] = await db.query(
        `SELECT m.id, m.name, m.email, m.subject, m.content, m.status, m.assigned_to, m.notes, m.handled_at, m.created_at,
                a.name AS assigned_name
         FROM messages m LEFT JOIN users a ON a.id = m.assigned_to
         ${where} ORDER BY m.created_at DESC`,
        status ? [status] : []
    );
    return rows;
};

exports.findById = async (id) => {
    const [rows] = await db.query("SELECT * FROM messages WHERE id = ?", [id]);
    return rows[0];
};

exports.update = async (id, { status, assignedTo, notes }) => {
    const updates = [];
    const values = [];
    if (status !== undefined) {
        updates.push("status = ?");
        values.push(status);
        if (status === "traite") updates.push("handled_at = COALESCE(handled_at, NOW())");
    }
    if (assignedTo !== undefined) {
        updates.push("assigned_to = ?");
        values.push(assignedTo || null);
    }
    if (notes !== undefined) {
        updates.push("notes = ?");
        values.push(notes || null);
    }
    if (!updates.length) return;
    values.push(id);
    await db.query(`UPDATE messages SET ${updates.join(", ")} WHERE id = ?`, values);
};

exports.remove = async (id) => {
    await db.query("DELETE FROM messages WHERE id = ?", [id]);
};

exports.countByStatus = async () => {
    const [rows] = await db.query("SELECT status, COUNT(*) AS total FROM messages GROUP BY status");
    return rows.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.total) }), {});
};
