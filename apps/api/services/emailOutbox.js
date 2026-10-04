// File d'envoi persistante des emails (table email_outbox) et worker interne au process API.
// Plusieurs instances peuvent tourner : chaque message est reserve atomiquement (claim) avant envoi.
const outboxRepo = require("../repositories/emailOutboxRepository");
const paymentRepo = require("../repositories/paymentRepository");
const logService = require("./activityLogService");
const transport = require("./emailTransport");
const { randomToken } = require("../utils/security");

const INTERVAL_MS = Number(process.env.EMAIL_OUTBOX_INTERVAL_MS || 15000);
const BATCH_SIZE = 10;
const BASE_DELAY_SECONDS = 30;
const MAX_DELAY_SECONDS = 3600;

// Backoff exponentiel : 30 s, 1 min, 2 min, 4 min... plafonne a 1 h.
function retryDelay(attempts) {
    return Math.min(BASE_DELAY_SECONDS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_SECONDS);
}

exports.enqueue = (message) => outboxRepo.create(message);

// Envoi immediat trace dans la file : le message est reserve des sa creation (le worker ne le
// prend pas). En cas d'echec : nouvel essai par le worker si retryOnFailure, sinon "failed".
exports.sendNow = async (message, { retryOnFailure = false } = {}) => {
    const claimId = randomToken(16);
    const id = await outboxRepo.create({ ...message, claimId });
    try {
        await transport.deliver(message);
    } catch (error) {
        console.error(`email-error #${id}:`, error.message);
        if (retryOnFailure) await outboxRepo.markRetry(id, claimId, error.message, retryDelay(1));
        else await outboxRepo.markFailed(id, claimId, error.message);
        return { id, sent: false };
    }
    await outboxRepo.markSent(id, claimId);
    await afterSent({ ...message, kind: message.kind, payment_id: message.paymentId })
        .catch((error) => console.error("email-outbox-after-sent:", error.message));
    return { id, sent: true };
};

async function afterSent(row) {
    if (row.kind === "donation_receipt" && row.payment_id) await paymentRepo.markReceiptSent(row.payment_id);
}

async function processRow(row, claimId) {
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
        await outboxRepo.markFailed(row.id, claimId, "expired");
        return "failed";
    }
    try {
        await transport.deliver({ to: row.to_address, subject: row.subject, text: row.body_text, attachments: row.attachments });
    } catch (error) {
        const message = error.message || String(error);
        console.error(`email-outbox-error #${row.id} (tentative ${row.attempts}/${row.max_attempts}):`, message);
        if (row.attempts >= row.max_attempts) {
            await outboxRepo.markFailed(row.id, claimId, message);
            await logService.log({
                action: "email.failed",
                meta: { outboxId: row.id, kind: row.kind, to: row.to_address, attempts: row.attempts, error: message.slice(0, 200) },
            });
            return "failed";
        }
        await outboxRepo.markRetry(row.id, claimId, message, retryDelay(row.attempts));
        return "retry";
    }
    await outboxRepo.markSent(row.id, claimId);
    await afterSent(row).catch((error) => console.error("email-outbox-after-sent:", error.message));
    return "sent";
}

// Traite un lot de messages dus (ou un message precis avec { id }). Renvoie le bilan.
exports.processBatch = async ({ limit = BATCH_SIZE, id } = {}) => {
    const summary = { sent: 0, retry: 0, failed: 0 };
    if (!transport.hasMailConfig()) return summary;
    const claimId = randomToken(16);
    const rows = await outboxRepo.claim({ claimId, limit, id });
    for (const row of rows) summary[await processRow(row, claimId)] += 1;
    return summary;
};

let timer = null;
let running = false;
let lastErrorLog = 0;

async function tick() {
    if (running) return;
    running = true;
    try {
        await exports.processBatch();
    } catch (error) {
        // Table absente (migration non appliquee) ou base indisponible : journal limite a 1 par 5 min.
        if (Date.now() - lastErrorLog > 5 * 60000) {
            lastErrorLog = Date.now();
            console.error("email-outbox-worker:", error.message);
        }
    } finally {
        running = false;
    }
}

// Demarre le worker (jamais pendant les tests : ils appellent processBatch explicitement).
exports.start = ({ intervalMs = INTERVAL_MS } = {}) => {
    if (timer || process.env.NODE_ENV === "test" || process.env.EMAIL_OUTBOX_WORKER === "false") return false;
    timer = setInterval(tick, intervalMs);
    timer.unref?.();
    tick();
    return true;
};

exports.stop = async () => {
    if (timer) clearInterval(timer);
    timer = null;
    // Laisse le lot en cours se terminer (borne par les timeouts SMTP).
    const deadline = Date.now() + 15000;
    while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
};

exports.retryDelay = retryDelay;
