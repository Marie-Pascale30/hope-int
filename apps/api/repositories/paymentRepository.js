const db = require("../config/db");

// Montant net (remboursements partiels deduits) converti en EUR.
const { DONOR_KEY_SQL, NET_AMOUNT_SQL: NET_SQL, NET_EUR_SQL: EUR_SQL } = require("../utils/sql");

const LIST_COLUMNS = `
  p.id, p.user_id, p.amount, p.currency, p.method, p.provider, p.status, p.transaction_id,
  p.frequency, p.subscription_id, p.project_id, p.receipt_number, p.receipt_token, p.paid_at, p.created_at,
  p.refunded_amount,
  COALESCE(u.name, p.donor_name) AS donor_name,
  COALESCE(u.email, p.donor_email) AS donor_email,
  pr.title AS project_title, pr.region AS project_region`;

// Detail d'un don : colonnes de liste + recu fige + suivi abonnement / remboursement.
const DETAIL_COLUMNS = `${LIST_COLUMNS},
  p.donor_name AS entered_donor_name, p.donor_email AS entered_donor_email, pr.status AS project_status,
  p.provider_payment_ref, p.subscription_status, p.refunded_at, p.receipt_sent_at,
  p.receipt_issued_at, p.receipt_donor_name, p.receipt_donor_email, p.receipt_designation,
  p.receipt_amount, p.receipt_currency, p.receipt_method, p.receipt_frequency, p.receipt_note`;

const LIST_FROM = `
  FROM payments p
  LEFT JOIN users u ON u.id = p.user_id
  LEFT JOIN projects pr ON pr.id = p.project_id`;

function mapPayment(row) {
    if (!row) return row;
    const mapped = { ...row, amount: Number(row.amount) };
    if (row.refunded_amount !== undefined) mapped.refunded_amount = Number(row.refunded_amount || 0);
    if (row.receipt_amount !== undefined && row.receipt_amount !== null) mapped.receipt_amount = Number(row.receipt_amount);
    return mapped;
}

function insertParams(data) {
    return [
        data.userId || null,
        data.amount,
        data.currency,
        data.method,
        data.provider,
        data.status || "pending",
        data.txId || null,
        data.donorName || null,
        data.donorEmail || null,
        data.projectId || null,
        data.frequency || "once",
        data.subscriptionId || null,
        data.subscriptionStatus || null,
        data.providerPaymentRef || null,
        data.receiptToken,
    ];
}

const INSERT_SQL = `INSERT INTO payments
   (user_id, amount, currency, method, provider, status, transaction_id, donor_name, donor_email,
    project_id, frequency, subscription_id, subscription_status, provider_payment_ref, receipt_token)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

exports.create = async (data) => {
    const [result] = await db.query(INSERT_SQL, insertParams(data));
    return result.insertId;
};

exports.setTransactionId = async (id, txId, subscriptionId = null) => {
    await db.query(
        "UPDATE payments SET transaction_id = ?, subscription_id = COALESCE(?, subscription_id) WHERE id = ?",
        [txId, subscriptionId, id]
    );
};

exports.findById = async (id) => {
    const [rows] = await db.query(`SELECT ${DETAIL_COLUMNS} ${LIST_FROM} WHERE p.id = ?`, [id]);
    return mapPayment(rows[0]);
};

exports.findByTxId = async (txId) => {
    const [rows] = await db.query(`SELECT ${DETAIL_COLUMNS} ${LIST_FROM} WHERE p.transaction_id = ? ORDER BY p.id ASC LIMIT 1`, [txId]);
    return mapPayment(rows[0]);
};

// Recherche par reference prestataire : transaction_id puis reference secondaire (PaymentIntent d'une facture).
exports.findByProviderRef = async (ref) => {
    if (!ref) return null;
    const [rows] = await db.query(
        `SELECT ${DETAIL_COLUMNS} ${LIST_FROM} WHERE p.transaction_id = ? OR p.provider_payment_ref = ?
         ORDER BY (p.transaction_id = ?) DESC, p.id ASC LIMIT 1`,
        [ref, ref, ref]
    );
    return mapPayment(rows[0]);
};

exports.findFirstBySubscription = async (subscriptionId) => {
    const [rows] = await db.query(
        `SELECT ${DETAIL_COLUMNS} ${LIST_FROM} WHERE p.subscription_id = ? ORDER BY p.id ASC LIMIT 1`,
        [subscriptionId]
    );
    return mapPayment(rows[0]);
};

exports.findByReceiptToken = async (token) => {
    const [rows] = await db.query(`SELECT ${DETAIL_COLUMNS} ${LIST_FROM} WHERE p.receipt_token = ?`, [token]);
    return mapPayment(rows[0]);
};

// Transition atomique : le statut n'est change que si le statut courant figure dans fromStatuses
// (decision prise par MySQL sur la ligne a jour, pas sur un objet lu avant). Renvoie true si applique.
exports.transitionStatus = async (id, status, fromStatuses, extra = {}) => {
    if (!fromStatuses?.length) return false;
    const sets = ["status = ?"];
    const params = [status];
    if (extra.refundedAmount !== undefined) {
        sets.push("refunded_amount = ?", "refunded_at = COALESCE(refunded_at, NOW())");
        params.push(extra.refundedAmount);
    }
    const [result] = await db.query(
        `UPDATE payments SET ${sets.join(", ")} WHERE id = ? AND status IN (?)`,
        [...params, id, fromStatuses]
    );
    return result.affectedRows > 0;
};

// Compatibilite : ne remplace jamais un don reussi (ni rembourse / conteste).
exports.updateStatus = async (id, status) =>
    exports.transitionStatus(id, status, ["pending", "failed", "canceled", "review"].filter((s) => s !== status));

// Remboursement partiel : le statut reste "succeeded", seul le montant rembourse evolue.
exports.setRefundedAmount = async (id, refundedAmount) => {
    const [result] = await db.query(
        `UPDATE payments SET refunded_amount = ?, refunded_at = COALESCE(refunded_at, NOW())
         WHERE id = ? AND status IN ('succeeded', 'disputed') AND refunded_amount <> ?`,
        [refundedAmount, id, refundedAmount]
    );
    return result.affectedRows > 0;
};

// Numero suivant de l'annee : increment atomique de la ligne receipt_sequences (verrouillee
// jusqu'a la fin de la transaction appelante, donc sans trou ni doublon en cas de rollback).
async function nextReceiptNumber(connection, year) {
    await connection.query(
        `INSERT INTO receipt_sequences (year, last_number) VALUES (?, LAST_INSERT_ID(1))
         ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
        [year]
    );
    const [[{ next }]] = await connection.query("SELECT LAST_INSERT_ID() AS next");
    return `HOPE-${year}-${String(next).padStart(6, "0")}`;
}

// Emission du recu : statut, date de paiement, numero et snapshot fige des donnees du recu.
// Le nom / email saisis sur le don priment sur ceux du compte.
async function issueReceipt(connection, id, { paidAt, year, note }) {
    const receiptNumber = await nextReceiptNumber(connection, year);
    await connection.query(
        `UPDATE payments p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN projects pr ON pr.id = p.project_id
         SET p.status = 'succeeded', p.paid_at = ?, p.receipt_number = ?, p.receipt_issued_at = ?,
             p.receipt_donor_name = COALESCE(NULLIF(p.donor_name, ''), u.name),
             p.receipt_donor_email = COALESCE(NULLIF(p.donor_email, ''), u.email),
             p.receipt_designation = pr.title,
             p.receipt_amount = p.amount,
             p.receipt_currency = p.currency,
             p.receipt_method = p.method,
             p.receipt_frequency = p.frequency,
             p.receipt_note = COALESCE(?, p.receipt_note)
         WHERE p.id = ?`,
        [paidAt, receiptNumber, paidAt, note || null, id]
    );
    return receiptNumber;
}

async function inTransaction(work) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Passage a "succeeded" depuis un des statuts autorises. yearOf(date) donne l'annee du recu
// dans le fuseau des recus. Renvoie { changed, issued } (issued : nouveau recu emis).
exports.markSucceeded = async (id, { fromStatuses, yearOf, note } = {}) =>
    inTransaction(async (connection) => {
        const [rows] = await connection.query(
            "SELECT id, status, receipt_number, paid_at FROM payments WHERE id = ? FOR UPDATE",
            [id]
        );
        const payment = rows[0];
        if (!payment || !fromStatuses.includes(payment.status)) return { changed: false, issued: false };

        // Recu deja emis (ex. litige gagne) : on retablit le statut sans renumeroter.
        if (payment.receipt_number) {
            await connection.query("UPDATE payments SET status = 'succeeded' WHERE id = ?", [id]);
            return { changed: true, issued: false };
        }
        const paidAt = payment.paid_at ? new Date(payment.paid_at) : new Date();
        const receiptNumber = await issueReceipt(connection, id, { paidAt, year: yearOf(paidAt), note });
        return { changed: true, issued: true, receiptNumber };
    });

// Echeance d'abonnement creee directement "succeeded" avec son recu, dans une seule transaction.
// Livraison concurrente du meme evenement : l'index unique (provider, transaction_id) leve
// ER_DUP_ENTRY, traite comme deja enregistre (renvoie null).
exports.createSucceeded = async (data, { yearOf, note } = {}) => {
    try {
        return await inTransaction(async (connection) => {
            const [result] = await connection.query(INSERT_SQL, insertParams({ ...data, status: "succeeded" }));
            const paidAt = data.paidAt || new Date();
            const receiptNumber = await issueReceipt(connection, result.insertId, { paidAt, year: yearOf(paidAt), note });
            return { id: result.insertId, receiptNumber };
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY" && /uq_payments_provider_tx/.test(error.message)) return null;
        throw error;
    }
};

exports.setSubscriptionStatus = async (subscriptionId, status, { onlyIf } = {}) => {
    let sql = "UPDATE payments SET subscription_status = ? WHERE subscription_id = ?";
    const params = [status, subscriptionId];
    if (onlyIf) {
        sql += " AND (subscription_status IS NULL OR subscription_status IN (?))";
        params.push(onlyIf);
    }
    const [result] = await db.query(sql, params);
    return result.affectedRows > 0;
};

exports.markReceiptSent = async (id) => {
    await db.query("UPDATE payments SET receipt_sent_at = NOW() WHERE id = ?", [id]);
};

// Uniquement les dons rattaches au compte : l'email n'etant pas verifie a l'inscription,
// on ne rattache pas les dons anonymes faits avec la meme adresse.
exports.getByUser = async (userId) => {
    const [rows] = await db.query(
        `SELECT ${DETAIL_COLUMNS} ${LIST_FROM} WHERE p.user_id = ? ORDER BY p.created_at DESC, p.id DESC`,
        [userId]
    );
    return rows.map(mapPayment);
};

// Dons reussis d'un compte payes dans un intervalle [from, to[ (dates UTC), pour le recapitulatif annuel.
exports.getSucceededByUserBetween = async (userId, from, to) => {
    const [rows] = await db.query(
        `SELECT ${DETAIL_COLUMNS} ${LIST_FROM}
         WHERE p.user_id = ? AND p.status = 'succeeded' AND p.paid_at >= ? AND p.paid_at < ?
         ORDER BY p.paid_at ASC, p.id ASC`,
        [userId, from, to]
    );
    return rows.map(mapPayment);
};

function buildFilters({ status, from, to, projectId, provider, region } = {}) {
    const clauses = [];
    const params = [];
    if (status) {
        clauses.push("p.status = ?");
        params.push(status);
    }
    if (from) {
        clauses.push("COALESCE(p.paid_at, p.created_at) >= ?");
        params.push(from);
    }
    if (to) {
        clauses.push("COALESCE(p.paid_at, p.created_at) < DATE_ADD(?, INTERVAL 1 DAY)");
        params.push(to);
    }
    if (projectId) {
        clauses.push("p.project_id = ?");
        params.push(projectId);
    }
    if (provider) {
        clauses.push("p.provider = ?");
        params.push(provider);
    }
    if (region) {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

exports.getAll = async (filters = {}) => {
    const { where, params } = buildFilters(filters);
    const [rows] = await db.query(
        `SELECT ${LIST_COLUMNS} ${LIST_FROM} ${where} ORDER BY p.created_at DESC LIMIT 2000`,
        params
    );
    return rows.map(mapPayment);
};

// Export comptable : memes filtres et colonnes que getAll, sans limite, ordre chronologique.
exports.getForExport = async (filters = {}) => {
    const { where, params } = buildFilters(filters);
    const [rows] = await db.query(
        `SELECT ${LIST_COLUMNS} ${LIST_FROM} ${where} ORDER BY COALESCE(p.paid_at, p.created_at) ASC, p.id ASC`,
        params
    );
    return rows.map(mapPayment);
};

exports.getPendingOlderThan = async (minutes) => {
    const [rows] = await db.query(
        "SELECT id, provider, transaction_id, created_at FROM payments WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)",
        [minutes]
    );
    return rows;
};

// Dons echoues / annules recents avec reference prestataire : relus pour rattraper un paiement tardif.
exports.getRecentlyClosed = async (days) => {
    const [rows] = await db.query(
        `SELECT id, provider, transaction_id, created_at FROM payments
         WHERE status IN ('failed', 'canceled') AND transaction_id IS NOT NULL
           AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days]
    );
    return rows;
};

exports.getSummary = async ({ year, region } = {}) => {
    const clauses = ["p.status = 'succeeded'"];
    const params = [];
    if (year) {
        clauses.push("YEAR(COALESCE(p.paid_at, p.created_at)) = ?");
        params.push(year);
    }
    if (region) {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    const where = `WHERE ${clauses.join(" AND ")}`;

    const [[totals]] = await db.query(
        `SELECT COALESCE(SUM(${EUR_SQL}), 0) AS total_eur, COUNT(*) AS count,
                COUNT(DISTINCT ${DONOR_KEY_SQL}) AS donors,
                COALESCE(AVG(${EUR_SQL}), 0) AS average_eur,
                COUNT(DISTINCT CASE WHEN p.frequency = 'monthly' THEN ${DONOR_KEY_SQL} END) AS recurring_donors
         ${LIST_FROM} ${where}`,
        params
    );
    const [byCurrency] = await db.query(
        `SELECT p.currency, COALESCE(SUM(${NET_SQL}), 0) AS amount, COUNT(*) AS count ${LIST_FROM} ${where} GROUP BY p.currency`,
        params
    );
    const [byProvider] = await db.query(
        `SELECT p.provider, p.method, COALESCE(SUM(${EUR_SQL}), 0) AS amount_eur, COUNT(*) AS count
         ${LIST_FROM} ${where} GROUP BY p.provider, p.method`,
        params
    );
    const [byProject] = await db.query(
        `SELECT p.project_id, COALESCE(pr.title, 'Fonds général') AS project_title,
                COALESCE(SUM(${EUR_SQL}), 0) AS amount_eur, COUNT(*) AS count
         ${LIST_FROM} ${where} GROUP BY p.project_id, pr.title ORDER BY amount_eur DESC`,
        params
    );
    const [byMonth] = await db.query(
        `SELECT DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m') AS month,
                COALESCE(SUM(${EUR_SQL}), 0) AS amount_eur, COUNT(*) AS count
         ${LIST_FROM} ${where} GROUP BY month ORDER BY month ASC`,
        params
    );
    const [[pending]] = await db.query(
        `SELECT COUNT(*) AS count FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id
         WHERE p.status = 'pending'${region ? " AND pr.region = ?" : ""}`,
        region ? [region] : []
    );

    const round = (value) => Math.round(Number(value) * 100) / 100;
    return {
        totalEur: round(totals.total_eur),
        count: Number(totals.count),
        donors: Number(totals.donors),
        averageEur: round(totals.average_eur),
        recurringDonors: Number(totals.recurring_donors),
        pendingCount: Number(pending.count),
        byCurrency: byCurrency.map((row) => ({ currency: row.currency, amount: round(row.amount), count: Number(row.count) })),
        byProvider: byProvider.map((row) => ({ provider: row.provider, method: row.method, amountEur: round(row.amount_eur), count: Number(row.count) })),
        byProject: byProject.map((row) => ({ projectId: row.project_id, title: row.project_title, amountEur: round(row.amount_eur), count: Number(row.count) })),
        byMonth: byMonth.map((row) => ({ month: row.month, amountEur: round(row.amount_eur), count: Number(row.count) })),
    };
};
