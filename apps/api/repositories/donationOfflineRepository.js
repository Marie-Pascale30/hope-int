// Dons hors ligne (especes, virement, cheque, en nature) saisis par la finance.
// Le justificatif (proof_data) n'est lu que par findProof.
const db = require("../config/db");

const COLUMNS = `
  o.id, o.kind, o.amount, o.currency, o.donor_name, o.donor_email, o.user_id, o.project_id, o.received_on,
  o.reference, o.in_kind_description, o.note, o.proof_mime, o.proof_name, (o.proof_data IS NOT NULL) AS has_proof,
  o.status, o.created_by, o.validated_by, o.validated_at, o.rejected_reason, o.payment_id, o.created_at,
  cu.name AS created_by_name, vu.name AS validated_by_name, pr.title AS project_title, pr.region AS project_region,
  p.receipt_number`;

const FROM = `
  FROM donation_offline o
  LEFT JOIN users cu ON cu.id = o.created_by
  LEFT JOIN users vu ON vu.id = o.validated_by
  LEFT JOIN projects pr ON pr.id = o.project_id
  LEFT JOIN payments p ON p.id = o.payment_id`;

const map = (row) => (row ? { ...row, amount: Number(row.amount), has_proof: Boolean(row.has_proof) } : row);

exports.create = async (data) => {
    const [result] = await db.query(
        `INSERT INTO donation_offline
           (kind, amount, currency, donor_name, donor_email, user_id, project_id, received_on, reference,
            in_kind_description, note, proof_data, proof_mime, proof_name, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.kind,
            data.amount,
            data.currency,
            data.donorName,
            data.donorEmail || null,
            data.userId || null,
            data.projectId || null,
            data.receivedOn,
            data.reference || null,
            data.inKindDescription || null,
            data.note || null,
            data.proof?.buffer || null,
            data.proof?.mime || null,
            data.proof?.name || null,
            data.createdBy,
        ]
    );
    return result.insertId;
};

exports.findById = async (id) => {
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE o.id = ?`, [id]);
    return map(rows[0]);
};

exports.findProof = async (id) => {
    const [rows] = await db.query("SELECT proof_data, proof_mime, proof_name FROM donation_offline WHERE id = ?", [id]);
    return rows[0] || null;
};

exports.getAll = async ({ status, region } = {}) => {
    const clauses = [];
    const params = [];
    if (status) {
        clauses.push("o.status = ?");
        params.push(status);
    }
    if (region) {
        clauses.push("pr.region = ?");
        params.push(region);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const [rows] = await db.query(`SELECT ${COLUMNS} ${FROM} ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT 500`, params);
    return rows.map(map);
};

exports.countPending = async () => {
    const [[row]] = await db.query("SELECT COUNT(*) AS count FROM donation_offline WHERE status = 'pending_validation'");
    return Number(row.count);
};

// Validation dans la transaction de creation du don (connexion fournie) : verrou de la ligne.
exports.lockForDecision = async (connection, id) => {
    const [rows] = await connection.query("SELECT * FROM donation_offline WHERE id = ? FOR UPDATE", [id]);
    return rows[0] || null;
};

exports.markValidated = async (connection, id, { validatedBy, paymentId }) => {
    await connection.query(
        `UPDATE donation_offline SET status = 'validated', validated_by = ?, validated_at = NOW(), payment_id = ?
         WHERE id = ? AND status = 'pending_validation'`,
        [validatedBy, paymentId, id]
    );
};

exports.markRejected = async (id, { rejectedBy, reason }) => {
    const [result] = await db.query(
        `UPDATE donation_offline SET status = 'rejected', validated_by = ?, validated_at = NOW(), rejected_reason = ?
         WHERE id = ? AND status = 'pending_validation'`,
        [rejectedBy, reason || null, id]
    );
    return result.affectedRows > 0;
};
