const db = require("../config/db");
const { DONOR_KEY_SQL, NET_EUR_SQL: EUR_SQL } = require("../utils/sql");
const { ACTIVE_IN_YEAR_SQL, activeInYearParams } = require("./contentRepository");

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

// Filtre regional (acteur restreint a sa region) : un don releve d'une region par le projet
// auquel il est affecte (les dons au fonds general n'ont pas de region) ; membres, candidatures
// et evenements par leur propre region.
function regionClause(column, region) {
    return region ? { sql: ` AND ${column} = ?`, params: [region] } : { sql: "", params: [] };
}

const PAYMENT_FROM = "FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id";

exports.getDashboard = async ({ region } = {}) => {
    const payRegion = regionClause("pr.region", region);
    const userRegion = regionClause("region", region);
    const [[donations]] = await db.query(
        `SELECT COALESCE(SUM(${EUR_SQL}), 0) AS total_eur, COUNT(*) AS count,
                COUNT(DISTINCT ${DONOR_KEY_SQL}) AS donors,
                COALESCE(SUM(CASE WHEN COALESCE(p.paid_at, p.created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN ${EUR_SQL} END), 0) AS last30_eur
         ${PAYMENT_FROM}
         WHERE p.status = 'succeeded'${payRegion.sql}`,
        payRegion.params
    );
    const [[users]] = await db.query(
        `SELECT COUNT(*) AS total, SUM(status = 'active') AS active,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS new30
         FROM users WHERE 1 = 1${userRegion.sql}`,
        userRegion.params
    );
    const [[applications]] = await db.query(
        `SELECT SUM(status = 'nouvelle') AS fresh, SUM(status = 'en_etude') AS reviewing
         FROM applications WHERE 1 = 1${userRegion.sql}`,
        userRegion.params
    );
    // Les messages n'ont pas de region : compteur global (meme perimetre que la liste des messages).
    const [[messages]] = await db.query("SELECT SUM(status = 'nouveau') AS unread FROM messages");
    // "A venir" : meme regle que l'agenda public (un evenement en cours reste a venir jusqu'a sa fin).
    const [[events]] = await db.query(
        `SELECT COUNT(*) AS upcoming FROM events
         WHERE published = 1 AND COALESCE(end_at, start_at) >= NOW()${userRegion.sql}`,
        userRegion.params
    );
    const [[pending]] = await db.query(
        `SELECT COUNT(*) AS total ${PAYMENT_FROM} WHERE p.status = 'pending'${payRegion.sql}`,
        payRegion.params
    );

    // 12 derniers mois glissants.
    const [monthlyDonations] = await db.query(
        `SELECT DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m') AS month, COALESCE(SUM(${EUR_SQL}), 0) AS amount
         ${PAYMENT_FROM}
         WHERE p.status = 'succeeded' AND COALESCE(p.paid_at, p.created_at) >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 11 MONTH)
         ${payRegion.sql}
         GROUP BY month ORDER BY month ASC`,
        payRegion.params
    );
    const [monthlyGrowth] = await db.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS users
         FROM users
         WHERE created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 11 MONTH)${userRegion.sql}
         GROUP BY month ORDER BY month ASC`,
        userRegion.params
    );

    return {
        region: region || null,
        totalDonations: round(donations.total_eur),
        donationsCount: Number(donations.count),
        donorsCount: Number(donations.donors),
        donationsLast30: round(donations.last30_eur),
        members: Number(users.total),
        activeMembers: Number(users.active || 0),
        newMembers30: Number(users.new30 || 0),
        pendingApplications: Number(applications.fresh || 0) + Number(applications.reviewing || 0),
        unreadMessages: Number(messages.unread || 0),
        upcomingEvents: Number(events.upcoming || 0),
        pendingPayments: Number(pending.total || 0),
        monthlyDonations: monthlyDonations.map((row) => ({ month: row.month, amount: round(row.amount) })),
        monthlyGrowth: monthlyGrowth.map((row) => ({ month: row.month, users: Number(row.users) })),
    };
};

exports.getPublicDonationTotals = async () => {
    const [[row]] = await db.query(
        `SELECT COALESCE(SUM(${EUR_SQL}), 0) AS total_eur,
                COUNT(DISTINCT ${DONOR_KEY_SQL}) AS donors
         FROM payments p WHERE p.status = 'succeeded'`
    );
    return { totalRaisedEur: round(row.total_eur), donors: Number(row.donors) };
};

exports.getYearActivity = async (year, { region } = {}) => {
    const userRegion = regionClause("region", region);
    const eventRegion = regionClause("e.region", region);
    const [[members]] = await db.query(
        `SELECT COUNT(*) AS total FROM users WHERE YEAR(created_at) = ?${userRegion.sql}`,
        [year, ...userRegion.params]
    );
    const [[events]] = await db.query(
        `SELECT COUNT(DISTINCT e.id) AS total, COUNT(r.id) AS registrations
         FROM events e LEFT JOIN event_registrations r ON r.event_id = e.id
         WHERE YEAR(e.start_at) = ?${eventRegion.sql}`,
        [year, ...eventRegion.params]
    );
    const [applications] = await db.query(
        `SELECT status, COUNT(*) AS total FROM applications WHERE YEAR(created_at) = ?${userRegion.sql} GROUP BY status`,
        [year, ...userRegion.params]
    );
    // Les messages n'ont pas de region : compteur global, y compris pour un acteur restreint.
    const [[messages]] = await db.query(
        "SELECT COUNT(*) AS total, SUM(status IN ('traite', 'archive')) AS handled FROM messages WHERE YEAR(created_at) = ?",
        [year]
    );
    // Projets actifs pendant l'annee (meme definition que l'impact du rapport annuel).
    const [projects] = await db.query(
        `SELECT id, title, status, region, beneficiaries, trainees, credits_granted, start_date, end_date
         FROM projects
         WHERE ${ACTIVE_IN_YEAR_SQL}${userRegion.sql}
         ORDER BY beneficiaries DESC`,
        [...activeInYearParams(year), ...userRegion.params]
    );

    return {
        newMembers: Number(members.total),
        events: Number(events.total),
        eventRegistrations: Number(events.registrations),
        applications: applications.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.total) }), {}),
        messages: { total: Number(messages.total), handled: Number(messages.handled || 0) },
        projects,
    };
};

exports.getAvailableYears = async () => {
    const [rows] = await db.query(
        `SELECT DISTINCT y FROM (
           SELECT YEAR(created_at) AS y FROM payments
           UNION SELECT YEAR(created_at) FROM users
           UNION SELECT YEAR(start_at) FROM events
         ) years WHERE y IS NOT NULL ORDER BY y DESC`
    );
    return rows.map((row) => Number(row.y));
};

exports.getTableCounts = async () => {
    const tables = [
        "users", "payments", "projects", "news", "testimonials", "messages", "applications",
        "events", "event_registrations", "activity_logs",
    ];
    const counts = {};
    for (const table of tables) {
        const [[row]] = await db.query(`SELECT COUNT(*) AS total FROM ${table}`);
        counts[table] = Number(row.total);
    }
    return counts;
};
