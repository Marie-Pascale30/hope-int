// Benevolat : heures saisies hors evenement, historique d'un membre et vue des benevoles par region.
const db = require("../config/db");

const toHours = (value) => (value === null || value === undefined ? 0 : Math.round(Number(value) * 100) / 100);

// Presences d'un membre (evenements ou il a ete pointe present). Periode : instants UTC [from, to[.
exports.getEventActivities = async (userId, { from, to } = {}) => {
    const clauses = ["r.user_id = ?", "r.attendance = 'present'"];
    const params = [userId];
    if (from) {
        clauses.push("e.start_at >= ?");
        params.push(from);
    }
    if (to) {
        clauses.push("e.start_at < ?");
        params.push(to);
    }
    const [rows] = await db.query(
        `SELECT e.id AS event_id, e.title, e.start_at, e.end_at, e.location, e.region, r.hours
         FROM event_registrations r JOIN events e ON e.id = r.event_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY e.start_at DESC`,
        params
    );
    return rows.map((row) => ({ ...row, hours: toHours(row.hours) }));
};

// Missions saisies hors evenement. Periode : dates locales "AAAA-MM-JJ" incluses.
exports.getMissions = async (userId, { fromDate, toDate } = {}) => {
    const clauses = ["h.user_id = ?"];
    const params = [userId];
    if (fromDate) {
        clauses.push("h.activity_date >= ?");
        params.push(fromDate);
    }
    if (toDate) {
        clauses.push("h.activity_date <= ?");
        params.push(toDate);
    }
    const [rows] = await db.query(
        `SELECT h.id, h.mission, h.activity_date, h.hours, h.description, h.created_at, u.name AS created_by_name
         FROM volunteer_hours h LEFT JOIN users u ON u.id = h.created_by
         WHERE ${clauses.join(" AND ")}
         ORDER BY h.activity_date DESC, h.id DESC`,
        params
    );
    return rows.map((row) => ({ ...row, hours: toHours(row.hours) }));
};

exports.createHours = async ({ userId, mission, activityDate, hours, description, createdBy }) => {
    const [result] = await db.query(
        `INSERT INTO volunteer_hours (user_id, mission, activity_date, hours, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, mission, activityDate, hours, description || null, createdBy]
    );
    return result.insertId;
};

exports.findHours = async (id) => {
    const [rows] = await db.query("SELECT * FROM volunteer_hours WHERE id = ?", [id]);
    return rows[0] ? { ...rows[0], hours: toHours(rows[0].hours) } : null;
};

exports.removeHours = async (id) => {
    const [result] = await db.query("DELETE FROM volunteer_hours WHERE id = ?", [id]);
    return result.affectedRows;
};

exports.findUser = async (id) => {
    const [rows] = await db.query("SELECT id, name, email, region, status FROM users WHERE id = ?", [id]);
    return rows[0] || null;
};

// Benevoles (comptes actifs) avec heures, nombre d'engagements et dernier engagement.
// Filtres : region, q (nom, email, competences), engaged (au moins une presence ou mission).
exports.listVolunteers = async ({ region, q, engaged } = {}) => {
    const clauses = ["u.status = 'active'"];
    const params = [];
    if (region) {
        clauses.push("u.region = ?");
        params.push(region);
    }
    if (q) {
        clauses.push("(u.name LIKE ? OR u.email LIKE ? OR u.skills LIKE ? OR u.availability LIKE ?)");
        const like = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
        params.push(like, like, like, like);
    }
    if (engaged) clauses.push("(ev.user_id IS NOT NULL OR vh.user_id IS NOT NULL)");

    const [rows] = await db.query(
        `SELECT u.id, u.name, u.email, u.phone, u.region, u.skills, u.availability, u.created_at,
                COALESCE(ev.hours, 0) AS event_hours, COALESCE(ev.events, 0) AS events_count, ev.last_event,
                COALESCE(vh.hours, 0) AS other_hours, COALESCE(vh.missions, 0) AS missions_count, vh.last_mission
         FROM users u
         LEFT JOIN (
           SELECT r.user_id, SUM(r.hours) AS hours, COUNT(*) AS events, MAX(e.start_at) AS last_event
           FROM event_registrations r JOIN events e ON e.id = r.event_id
           WHERE r.attendance = 'present' GROUP BY r.user_id
         ) ev ON ev.user_id = u.id
         LEFT JOIN (
           SELECT user_id, SUM(hours) AS hours, COUNT(*) AS missions, MAX(activity_date) AS last_mission
           FROM volunteer_hours GROUP BY user_id
         ) vh ON vh.user_id = u.id
         WHERE ${clauses.join(" AND ")}
         ORDER BY u.region IS NULL, u.region, u.name
         LIMIT 5000`,
        params
    );
    return rows.map((row) => {
        const lastMission = !row.last_mission
            ? null
            : typeof row.last_mission === "string" ? new Date(`${row.last_mission}T12:00:00Z`) : new Date(row.last_mission);
        const lastEvent = row.last_event ? new Date(row.last_event) : null;
        const last = [lastEvent, lastMission].filter(Boolean).sort((a, b) => b - a)[0] || null;
        const eventHours = toHours(row.event_hours);
        const otherHours = toHours(row.other_hours);
        return {
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            region: row.region,
            skills: row.skills,
            availability: row.availability,
            created_at: row.created_at,
            event_hours: eventHours,
            other_hours: otherHours,
            total_hours: toHours(eventHours + otherHours),
            events_count: Number(row.events_count),
            missions_count: Number(row.missions_count),
            last_activity_at: last ? last.toISOString() : null,
        };
    });
};
