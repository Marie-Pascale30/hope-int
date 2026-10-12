// Requetes transverses de la collecte de fonds : marqueurs d'envoi idempotents, relances des
// paiements abandonnes, e-cartes d'hommage, indicateurs financiers (sources, dons mensuels).
const db = require("../config/db");
const { DONOR_KEY_SQL, NET_EUR_SQL } = require("../utils/sql");
const { yearBounds } = require("../utils/timezone");
const { XAF_PER_EUR } = require("@hope/shared/constants");

// --- Marqueurs (une seule fois par (kind, ref_key)) ---

// Pose le marqueur ; renvoie true si c'est la premiere fois (l'appelant peut alors agir).
exports.claimMarker = async (kind, refKey) => {
    const [result] = await db.query("INSERT IGNORE INTO fundraising_markers (kind, ref_key) VALUES (?, ?)", [kind, String(refKey)]);
    return result.affectedRows > 0;
};

exports.hasMarker = async (kind, refKey) => {
    const [rows] = await db.query("SELECT 1 FROM fundraising_markers WHERE kind = ? AND ref_key = ?", [kind, String(refKey)]);
    return rows.length > 0;
};

exports.releaseMarker = async (kind, refKey) => {
    await db.query("DELETE FROM fundraising_markers WHERE kind = ? AND ref_key = ?", [kind, String(refKey)]);
};

exports.countMarkers = async (kind, prefix) => {
    const [[row]] = await db.query(
        "SELECT COUNT(*) AS count FROM fundraising_markers WHERE kind = ? AND ref_key LIKE ?",
        [kind, `${prefix}%`]
    );
    return Number(row.count);
};

// --- Relance des paiements abandonnes ---

// Dons echoues, annules ou restes en attente : 1re relance apres firstHours, 2de apres secondHours
// (au plus), dans la fenetre maxDays. Exclus : dons hors ligne, donateur sans email, donateur ayant
// donne avec succes (ou retente) depuis.
exports.getAbandonedForReminder = async ({ firstHours, secondHours, maxDays, limit }) => {
    const [rows] = await db.query(
        `SELECT p.id, p.reminder_count
         FROM payments p
         WHERE p.status IN ('failed', 'canceled', 'pending')
           AND p.provider <> 'offline'
           AND p.donor_email IS NOT NULL AND p.donor_email <> ''
           AND p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
           AND (
             (p.reminder_count = 0 AND p.created_at < DATE_SUB(NOW(), INTERVAL ? HOUR))
             OR (p.reminder_count = 1 AND p.created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
                 AND p.reminder_sent_at < DATE_SUB(NOW(), INTERVAL 12 HOUR))
           )
           AND NOT EXISTS (
             SELECT 1 FROM payments n
             WHERE n.id <> p.id AND n.created_at >= p.created_at
               AND (LOWER(n.donor_email) = LOWER(p.donor_email) OR (p.user_id IS NOT NULL AND n.user_id = p.user_id))
               AND (n.status IN ('succeeded', 'review', 'disputed', 'refunded') OR n.id > p.id)
           )
         ORDER BY p.created_at ASC
         LIMIT ?`,
        [maxDays, firstHours, secondHours, limit]
    );
    return rows;
};

// Reservation atomique d'une relance (une instance a la fois) : true si cette instance l'envoie.
exports.claimReminder = async (paymentId, expectedCount) => {
    const [result] = await db.query(
        `UPDATE payments SET reminder_count = reminder_count + 1, reminder_sent_at = NOW()
         WHERE id = ? AND reminder_count = ? AND status IN ('failed', 'canceled', 'pending')`,
        [paymentId, expectedCount]
    );
    return result.affectedRows > 0;
};

// --- E-carte d'hommage ---

exports.claimTributeNotification = async (paymentId) => {
    const [result] = await db.query(
        `UPDATE payments SET tribute_notified_at = NOW()
         WHERE id = ? AND tribute_notified_at IS NULL AND tribute_notify_email IS NOT NULL AND status = 'succeeded'`,
        [paymentId]
    );
    return result.affectedRows > 0;
};

// --- Recapitulatifs annuels ---

// Comptes ayant au moins un don confirme dans l'annee, non encore servis (marqueur annual_summary).
exports.getAnnualSummaryRecipients = async (year, limit) => {
    const { from, to } = yearBounds(Number(year));
    const [rows] = await db.query(
        `SELECT u.id, u.name, u.email
         FROM users u
         WHERE u.status = 'active'
           AND EXISTS (SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status = 'succeeded' AND p.paid_at >= ? AND p.paid_at < ?)
           AND NOT EXISTS (SELECT 1 FROM fundraising_markers m WHERE m.kind = 'annual_summary' AND m.ref_key = CONCAT(?, ':', u.id))
         ORDER BY u.id ASC
         LIMIT ?`,
        [from, to, String(year), limit]
    );
    return rows;
};

exports.countAnnualSummaryRecipients = async (year) => {
    const { from, to } = yearBounds(Number(year));
    const [[row]] = await db.query(
        `SELECT COUNT(DISTINCT p.user_id) AS count FROM payments p JOIN users u ON u.id = p.user_id
         WHERE u.status = 'active' AND p.status = 'succeeded' AND p.paid_at >= ? AND p.paid_at < ?`,
        [from, to]
    );
    return Number(row.count);
};

// --- Indicateurs financiers ---

function scopeClauses({ from, to, region }) {
    const clauses = ["p.status = 'succeeded'"];
    const params = [];
    if (from) {
        clauses.push("p.paid_at >= ?");
        params.push(from);
    }
    if (to) {
        clauses.push("p.paid_at < ?");
        params.push(to);
    }
    if (region) {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    return { where: `WHERE ${clauses.join(" AND ")}`, params };
}

const round = (value) => Math.round(Number(value) * 100) / 100;

// Ventilation des dons confirmes par source (null : acces direct).
exports.getBySource = async ({ year, region } = {}) => {
    const range = year ? yearBounds(Number(year)) : {};
    const { where, params } = scopeClauses({ ...range, region });
    const [rows] = await db.query(
        `SELECT p.source, COALESCE(SUM(${NET_EUR_SQL}), 0) AS amount_eur, COUNT(*) AS count,
                COUNT(DISTINCT ${DONOR_KEY_SQL}) AS donors
         FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id
         ${where} GROUP BY p.source ORDER BY amount_eur DESC`,
        params
    );
    return rows.map((row) => ({ source: row.source, amountEur: round(row.amount_eur), count: Number(row.count), donors: Number(row.donors) }));
};

// Dons mensuels Stripe : un abonnement = sa premiere ligne (montant engage), statut courant.
// MRR : somme des montants mensuels des abonnements actifs (active, trialing, past_due) en EUR.
// Attrition sur 30 jours : abonnements arretes dans les 30 derniers jours / (actifs + arretes).
exports.getRecurringStats = async ({ region } = {}) => {
    const params = [];
    let regionClause = "";
    if (region) {
        regionClause = "AND pr.region = ?";
        params.push(region);
    }
    const [rows] = await db.query(
        `SELECT p.subscription_id, p.amount, p.currency, p.subscription_status, p.subscription_ended_at
         FROM payments p
         LEFT JOIN projects pr ON pr.id = p.project_id
         WHERE p.subscription_id IS NOT NULL
           AND p.id = (SELECT MIN(f.id) FROM payments f WHERE f.subscription_id = p.subscription_id)
           ${regionClause}`,
        params
    );
    const toEur = (amount, currency) => (currency === "xaf" ? Number(amount) / XAF_PER_EUR : Number(amount));
    const ongoing = ["active", "trialing", "past_due"];
    const since = Date.now() - 30 * 24 * 3600 * 1000;
    let mrrEur = 0;
    let active = 0;
    let pastDue = 0;
    let canceledLast30 = 0;
    let canceledTotal = 0;
    for (const row of rows) {
        if (ongoing.includes(row.subscription_status)) {
            active += 1;
            mrrEur += toEur(row.amount, row.currency);
            if (row.subscription_status === "past_due") pastDue += 1;
        } else if (row.subscription_status === "canceled") {
            canceledTotal += 1;
            if (row.subscription_ended_at && new Date(row.subscription_ended_at).getTime() >= since) canceledLast30 += 1;
        }
    }
    const base = active + canceledLast30;
    return {
        mrrEur: round(mrrEur),
        active,
        pastDue,
        canceledLast30,
        canceledTotal,
        churnRate30: base ? round((canceledLast30 / base) * 100) : 0,
    };
};
