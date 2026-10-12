// Attestations de benevolat : donnees figees a l'emission, retrouvees par leur code.
const db = require("../config/db");

function mapCertificate(row) {
    if (!row) return null;
    let badges = [];
    try {
        badges = row.badges ? JSON.parse(row.badges) : [];
    } catch (_error) {
        badges = [];
    }
    return {
        ...row,
        total_hours: Number(row.total_hours),
        event_hours: Number(row.event_hours),
        other_hours: Number(row.other_hours),
        events_count: Number(row.events_count),
        missions_count: Number(row.missions_count),
        badges: Array.isArray(badges) ? badges : [],
    };
}

exports.create = async (certificate) => {
    const [result] = await db.query(
        `INSERT INTO volunteer_certificates
           (code, user_id, holder_name, period_start, period_end, total_hours, event_hours, other_hours,
            events_count, missions_count, badges)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            certificate.code,
            certificate.userId,
            certificate.holderName,
            certificate.periodStart,
            certificate.periodEnd,
            certificate.totalHours,
            certificate.eventHours,
            certificate.otherHours,
            certificate.eventsCount,
            certificate.missionsCount,
            JSON.stringify(certificate.badges || []),
        ]
    );
    return result.insertId;
};

exports.findById = async (id) => {
    const [rows] = await db.query("SELECT * FROM volunteer_certificates WHERE id = ?", [id]);
    return mapCertificate(rows[0]);
};

exports.findByCode = async (code) => {
    const [rows] = await db.query("SELECT * FROM volunteer_certificates WHERE code = ?", [code]);
    return mapCertificate(rows[0]);
};

// Attestation deja emise pour la meme periode et le meme total (demande repetee).
exports.findSame = async ({ userId, periodStart, periodEnd, totalHours }) => {
    const [rows] = await db.query(
        `SELECT * FROM volunteer_certificates
         WHERE user_id = ? AND period_start = ? AND period_end = ? AND total_hours = ?
         ORDER BY id DESC LIMIT 1`,
        [userId, periodStart, periodEnd, totalHours]
    );
    return mapCertificate(rows[0]);
};

exports.listForUser = async (userId) => {
    const [rows] = await db.query(
        "SELECT * FROM volunteer_certificates WHERE user_id = ? ORDER BY issued_at DESC, id DESC LIMIT 100",
        [userId]
    );
    return rows.map(mapCertificate);
};

exports.findUserName = async (userId) => {
    const [rows] = await db.query("SELECT name FROM users WHERE id = ?", [userId]);
    return rows[0]?.name || null;
};
