const db = require("../config/db");
const { XAF_PER_EUR } = require("@hope/shared/constants");

const EUR_SQL = `CASE WHEN p.currency = 'xaf' THEN p.amount / ${XAF_PER_EUR} ELSE p.amount END`;
const round = (value) => Math.round(Number(value || 0) * 100) / 100;

exports.getDashboard = async () => {
    const [[donations]] = await db.query(
        `SELECT COALESCE(SUM(${EUR_SQL}), 0) AS total_eur, COUNT(*) AS count,
                COUNT(DISTINCT COALESCE(u.email, p.donor_email)) AS donors,
                COALESCE(SUM(CASE WHEN COALESCE(p.paid_at, p.created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN ${EUR_SQL} END), 0) AS last30_eur
         FROM payments p LEFT JOIN users u ON u.id = p.user_id
         WHERE p.status = 'succeeded'`
    );
    const [[users]] = await db.query(
        `SELECT COUNT(*) AS total, SUM(status = 'active') AS active,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS new30
         FROM users`
    );
    const [[applications]] = await db.query(
        "SELECT SUM(status = 'nouvelle') AS fresh, SUM(status = 'en_etude') AS reviewing FROM applications"
    );
    const [[messages]] = await db.query("SELECT SUM(status = 'nouveau') AS unread FROM messages");
    const [[events]] = await db.query(
        "SELECT COUNT(*) AS upcoming FROM events WHERE published = 1 AND start_at >= NOW()"
    );
    const [[pending]] = await db.query("SELECT COUNT(*) AS total FROM payments WHERE status = 'pending'");

    // 12 derniers mois glissants.
    const [monthlyDonations] = await db.query(
        `SELECT DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m') AS month, COALESCE(SUM(${EUR_SQL}), 0) AS amount
         FROM payments p
         WHERE p.status = 'succeeded' AND COALESCE(p.paid_at, p.created_at) >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 11 MONTH)
         GROUP BY month ORDER BY month ASC`
    );
    const [monthlyGrowth] = await db.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS users
         FROM users
         WHERE created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 11 MONTH)
         GROUP BY month ORDER BY month ASC`
    );

    return {
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
                COUNT(DISTINCT COALESCE(u.email, p.donor_email)) AS donors
         FROM payments p LEFT JOIN users u ON u.id = p.user_id WHERE p.status = 'succeeded'`
    );
    return { totalRaisedEur: round(row.total_eur), donors: Number(row.donors) };
};

exports.getYearActivity = async (year) => {
    const [[members]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE YEAR(created_at) = ?", [year]);
    const [[events]] = await db.query(
        `SELECT COUNT(DISTINCT e.id) AS total, COUNT(r.id) AS registrations
         FROM events e LEFT JOIN event_registrations r ON r.event_id = e.id
         WHERE YEAR(e.start_at) = ?`,
        [year]
    );
    const [applications] = await db.query(
        "SELECT status, COUNT(*) AS total FROM applications WHERE YEAR(created_at) = ? GROUP BY status",
        [year]
    );
    const [[messages]] = await db.query(
        "SELECT COUNT(*) AS total, SUM(status IN ('traite', 'archive')) AS handled FROM messages WHERE YEAR(created_at) = ?",
        [year]
    );
    const [projects] = await db.query(
        `SELECT id, title, status, region, beneficiaries, trainees, credits_granted, start_date, end_date
         FROM projects
         WHERE (start_date IS NULL OR YEAR(start_date) <= ?) AND (end_date IS NULL OR YEAR(end_date) >= ?)
         ORDER BY beneficiaries DESC`,
        [year, year]
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
