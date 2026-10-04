// Integrite des paiements : idempotence des echeances, remboursements / litiges, abonnements,
// recus figes (snapshot) et numerotation atomique, file d'envoi des emails.
// Rejouable : chaque etape verifie l'etat du schema avant de le modifier.
const { addColumn, addIndex } = require("../config/schema");

async function addPaymentColumns(db) {
    // Remboursements et litiges
    await addColumn("payments", "refunded_amount", "DECIMAL(12,2) NOT NULL DEFAULT 0");
    await addColumn("payments", "refunded_at", "DATETIME NULL");
    // Reference secondaire chez le prestataire (ex. PaymentIntent d'une facture Stripe in_...)
    await addColumn("payments", "provider_payment_ref", "VARCHAR(255) NULL");
    // Statut de l'abonnement Stripe (active, past_due, canceled...) tenu a jour par les webhooks
    await addColumn("payments", "subscription_status", "VARCHAR(30) NULL");
    // Email de recu reellement parti (relance possible sinon)
    await addColumn("payments", "receipt_sent_at", "DATETIME NULL");

    // Recu fige a l'emission
    await addColumn("payments", "receipt_issued_at", "DATETIME NULL");
    await addColumn("payments", "receipt_donor_name", "VARCHAR(150) NULL");
    await addColumn("payments", "receipt_donor_email", "VARCHAR(180) NULL");
    await addColumn("payments", "receipt_designation", "VARCHAR(255) NULL");
    await addColumn("payments", "receipt_amount", "DECIMAL(12,2) NULL");
    await addColumn("payments", "receipt_currency", "VARCHAR(10) NULL");
    await addColumn("payments", "receipt_method", "VARCHAR(50) NULL");
    await addColumn("payments", "receipt_frequency", "VARCHAR(20) NULL");
    await addColumn("payments", "receipt_note", "VARCHAR(255) NULL");

    // Backfill des recus deja emis (donnees courantes : meilleure approximation disponible).
    await db.query(
        `UPDATE payments p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN projects pr ON pr.id = p.project_id
         SET p.receipt_issued_at = COALESCE(p.paid_at, p.created_at),
             p.receipt_donor_name = COALESCE(NULLIF(p.donor_name, ''), u.name),
             p.receipt_donor_email = COALESCE(NULLIF(p.donor_email, ''), u.email),
             p.receipt_designation = pr.title,
             p.receipt_amount = p.amount,
             p.receipt_currency = p.currency,
             p.receipt_method = p.method,
             p.receipt_frequency = p.frequency
         WHERE p.receipt_number IS NOT NULL AND p.receipt_issued_at IS NULL`
    );
}

async function createReceiptSequences(db) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS receipt_sequences (
      year INT PRIMARY KEY,
      last_number INT NOT NULL DEFAULT 0
    )
  `);
    // Reprise des numeros existants (HOPE-2026-000042) : jamais de retour en arriere.
    await db.query(
        `INSERT INTO receipt_sequences (year, last_number)
         SELECT CAST(SUBSTRING(receipt_number, 6, 4) AS UNSIGNED) AS y,
                MAX(CAST(SUBSTRING(receipt_number, 11) AS UNSIGNED)) AS n
         FROM payments
         WHERE receipt_number REGEXP '^HOPE-[0-9]{4}-[0-9]+$'
         GROUP BY y
         ON DUPLICATE KEY UPDATE last_number = GREATEST(receipt_sequences.last_number, VALUES(last_number))`
    );
}

// Doublons (provider, transaction_id) eventuels : aucune ligne n'est supprimee (tracabilite
// comptable). La ligne de reference (recu emis, sinon la plus ancienne) garde sa reference,
// les autres sont suffixees "#dup-<id>" et l'operation est journalisee.
async function dedupeTransactions(db) {
    const [groups] = await db.query(
        `SELECT provider, transaction_id FROM payments
         WHERE transaction_id IS NOT NULL
         GROUP BY provider, transaction_id HAVING COUNT(*) > 1`
    );
    for (const group of groups) {
        const [rows] = await db.query(
            `SELECT id, status, receipt_number FROM payments WHERE provider = ? AND transaction_id = ?
             ORDER BY (receipt_number IS NULL) ASC, id ASC`,
            [group.provider, group.transaction_id]
        );
        const [keep, ...duplicates] = rows;
        for (const row of duplicates) {
            await db.query(
                "UPDATE payments SET transaction_id = CONCAT(LEFT(transaction_id, 230), '#dup-', id) WHERE id = ?",
                [row.id]
            );
        }
        await db.query("INSERT INTO activity_logs (action, meta) VALUES (?, ?)", [
            "payment.duplicate_transaction",
            JSON.stringify({
                provider: group.provider,
                transactionId: group.transaction_id,
                keptPaymentId: keep.id,
                renamed: duplicates.map((row) => ({ id: row.id, status: row.status, receiptNumber: row.receipt_number })),
            }),
        ]);
    }
}

async function createEmailOutbox(db) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS email_outbox (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kind VARCHAR(60) NOT NULL DEFAULT 'generic',
      to_address VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      body_text MEDIUMTEXT NULL,
      attachments LONGTEXT NULL,
      payment_id INT NULL,
      is_sensitive TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 6,
      next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NULL,
      locked_until DATETIME NULL,
      claimed_by VARCHAR(64) NULL,
      last_error VARCHAR(500) NULL,
      sent_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email_outbox_due (status, next_attempt_at),
      INDEX idx_email_outbox_claim (claimed_by)
    )
  `);
}

exports.up = async ({ db }) => {
    await addPaymentColumns(db);
    await createReceiptSequences(db);
    await dedupeTransactions(db);
    await addIndex("payments", "uq_payments_provider_tx", "UNIQUE INDEX uq_payments_provider_tx (provider, transaction_id)");
    await addIndex("payments", "idx_payments_status_paid", "INDEX idx_payments_status_paid (status, paid_at)");
    await addIndex("payments", "idx_payments_subscription", "INDEX idx_payments_subscription (subscription_id)");
    await addIndex("payments", "idx_payments_provider_ref", "INDEX idx_payments_provider_ref (provider_payment_ref)");
    await createEmailOutbox(db);
};
