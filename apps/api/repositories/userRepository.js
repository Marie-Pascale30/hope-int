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

// connection : connexion d'une transaction en cours (pool par defaut).
exports.create = async (user, connection = db) => {
    const roles = user.roles && user.roles.length ? user.roles : [user.role];
    const [result] = await connection.query(
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

// Sans pagination : tableau complet. Avec { limit, offset } : { rows, total }.
// Filtres : region, status, role (contenu dans la liste des roles), q (nom ou email).
exports.getAll = async ({ region, status, role, q } = {}, pagination = null) => {
    const clauses = [];
    const params = [];
    if (region) { clauses.push("region = ?"); params.push(region); }
    if (status) { clauses.push("status = ?"); params.push(status); }
    if (role) { clauses.push("JSON_CONTAINS(roles, JSON_QUOTE(?))"); params.push(role); }
    if (q) {
        clauses.push("(name LIKE ? OR email LIKE ?)");
        // Les jokers LIKE saisis (%, _) sont recherches litteralement.
        const pattern = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
        params.push(pattern, pattern);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = pagination ? " LIMIT ? OFFSET ?" : "";
    const [rows] = await db.query(
        `SELECT ${PUBLIC_COLUMNS} FROM users ${where} ORDER BY created_at DESC, id DESC${limit}`,
        pagination ? [...params, pagination.limit, pagination.offset] : params
    );
    if (!pagination) return rows.map(mapUserRow);
    const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM users ${where}`, params);
    return { rows: rows.map(mapUserRow), total: Number(count.total) };
};

exports.updateRoles = async (id, roles, connection = db) => {
    await connection.query("UPDATE users SET role = ?, roles = ? WHERE id = ?", [
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
        // Un champ undefined n'est jamais ecrit (evite d'ecraser une valeur par NULL).
        if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== undefined) {
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
