const db = require("../config/db");

// Colonnes exposables (jamais le hash du mot de passe).
const PUBLIC_COLUMNS =
    "id, name, email, role, roles, phone, region, skills, availability, status, must_change_password, last_login_at, created_at";

function parseRoles(rawRoles, fallbackRole = "membre") {
    if (!rawRoles) return [fallbackRole];
    try {
        const parsed = JSON.parse(rawRoles);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    } catch (_error) {
        // Ignore and fallback to single role.
    }
    return [fallbackRole];
}

function mapUserRow(row) {
    if (!row) return row;
    return {
        ...row,
        roles: parseRoles(row.roles, row.role),
        must_change_password: row.must_change_password === undefined ? undefined : Boolean(row.must_change_password),
    };
}

// Inclut le hash : reserve a l'authentification.
exports.findByEmailWithPassword = async (email) => {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    return mapUserRow(rows[0]);
};

exports.findByEmail = async (email) => {
    const [rows] = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE email = ?`, [email]);
    return mapUserRow(rows[0]);
};

exports.findAuthById = async (id) => {
    const [rows] = await db.query(
        "SELECT id, name, email, role, roles, region, status, must_change_password, token_version FROM users WHERE id = ?",
        [id]
    );
    return mapUserRow(rows[0]);
};

exports.findPasswordHashById = async (id) => {
    const [rows] = await db.query("SELECT password FROM users WHERE id = ?", [id]);
    return rows[0]?.password || null;
};

exports.findById = async (id) => {
    const [rows] = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`, [id]);
    return mapUserRow(rows[0]);
};

exports.create = async (user) => {
    const roles = user.roles && user.roles.length ? user.roles : [user.role];
    const [result] = await db.query(
        `INSERT INTO users (name, email, password, role, roles, phone, region, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            user.name,
            user.email,
            user.password,
            roles[0],
            JSON.stringify(roles),
            user.phone || null,
            user.region || null,
            user.mustChangePassword ? 1 : 0,
        ]
    );
    return result.insertId;
};

exports.getAll = async ({ region } = {}) => {
    const where = region ? "WHERE region = ?" : "";
    const [rows] = await db.query(
        `SELECT ${PUBLIC_COLUMNS} FROM users ${where} ORDER BY created_at DESC`,
        region ? [region] : []
    );
    return rows.map(mapUserRow);
};

exports.updateRoles = async (id, roles) => {
    await db.query("UPDATE users SET role = ?, roles = ? WHERE id = ?", [
        roles[0] || "membre",
        JSON.stringify(roles),
        id,
    ]);
};

const PROFILE_FIELDS = ["name", "phone", "region", "skills", "availability", "status"];

exports.updateProfile = async (id, payload) => {
    const updates = [];
    const values = [];
    PROFILE_FIELDS.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
            updates.push(`${field} = ?`);
            values.push(payload[field] === "" ? null : payload[field]);
        }
    });
    if (!updates.length) return;
    values.push(id);
    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
};

exports.bumpTokenVersion = async (id) => {
    await db.query("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [id]);
};

exports.updatePassword = async (id, hash, { mustChange = false } = {}) => {
    await db.query(
        "UPDATE users SET password = ?, must_change_password = ?, token_version = token_version + 1 WHERE id = ?",
        [hash, mustChange ? 1 : 0, id]
    );
};

exports.touchLogin = async (id) => {
    await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [id]);
};

// Nombre d'administrateurs actifs (le role admin est toujours seul dans `roles`).
exports.countActiveAdmins = async () => {
    const [rows] = await db.query(
        "SELECT COUNT(*) AS total FROM users WHERE status = 'active' AND JSON_CONTAINS(roles, '\"admin\"')"
    );
    return Number(rows[0]?.total || 0);
};

exports.remove = async (id) => {
    await db.query("DELETE FROM users WHERE id = ?", [id]);
};
