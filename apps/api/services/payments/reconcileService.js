// Rapprochement : relit aupres des prestataires les dons restes en attente, ainsi que les dons
// echoues / annules recents (paiement confirme tardivement). Lance a la demande (Finance ->
// Rapprocher) ou par le worker planifie interne au process API.
const db = require("../../config/db");
const paymentRepo = require("../../repositories/paymentRepository");
const settingsRepo = require("../../repositories/settingsRepository");
const logService = require("../activityLogService");
const { REFRESHABLE_STATUSES } = require("./statusService");
const { providerOf, refreshPayment } = require("./refreshService");
const { conflict } = require("../../utils/httpError");

// Au-dela de ce delai, un paiement toujours en attente est considere comme abandonne.
const ABANDON_AFTER_MINUTES = 24 * 60;
// Les dons echoues / annules recents sont relus par le rapprochement (paiement valide tardivement).
const RECHECK_CLOSED_DAYS = 7;
// Verrou MySQL nomme : une seule execution a la fois, toutes instances de l'API confondues.
const LOCK_NAME = "hope_payments_reconcile";
// Derniere execution (date, origine, bilan), consultable dans l'etat du systeme.
const LAST_RUN_KEY = "reconcile_last_run";
const INTERVAL_MS = Number(process.env.RECONCILE_INTERVAL_MS || 20 * 60 * 1000);
const FIRST_RUN_DELAY_MS = 60 * 1000;

async function run(actor, source) {
    const started = Date.now();
    const pending = await paymentRepo.getPendingOlderThan(15);
    const closed = await paymentRepo.getRecentlyClosed(RECHECK_CLOSED_DAYS);
    const summary = {
        checked: pending.length + closed.length,
        succeeded: 0,
        recovered: 0,
        failed: 0,
        review: 0,
        abandoned: 0,
        errors: 0,
    };

    for (const row of [...pending, ...closed]) {
        const payment = await paymentRepo.findById(row.id);
        if (!payment) continue;
        const before = payment.status;
        try {
            const provider = providerOf(payment.provider);
            if (provider?.isEnabled() && REFRESHABLE_STATUSES.includes(before)) await refreshPayment(payment, { source: "reconcile" });
        } catch (error) {
            summary.errors += 1;
            console.error(`reconcile-error #${payment.id}:`, error.message);
        }

        const after = await paymentRepo.findById(row.id);
        if (after.status === "succeeded") {
            summary.succeeded += 1;
            if (before !== "pending") summary.recovered += 1;
        } else if (after.status === "review") {
            summary.review += 1;
        } else if (after.status === "failed" && before === "pending") {
            summary.failed += 1;
        } else if (after.status === "pending" && Date.now() - new Date(after.created_at).getTime() > ABANDON_AFTER_MINUTES * 60000) {
            if (await paymentRepo.transitionStatus(after.id, "canceled", ["pending"])) {
                summary.abandoned += 1;
                await logService.log({
                    userId: after.user_id,
                    action: "payment.abandoned",
                    meta: { paymentId: after.id, provider: after.provider, createdAt: after.created_at, source: "reconcile" },
                });
            }
        }
    }

    const durationMs = Date.now() - started;
    await logService.log({ userId: actor?.id || null, action: "finance.reconcile", meta: { ...summary, source, durationMs } });
    await settingsRepo.set(LAST_RUN_KEY, JSON.stringify({ at: new Date().toISOString(), source, durationMs, summary }))
        .catch((error) => console.error("reconcile-last-run:", error.message));
    return summary;
}

// Execute work() sous le verrou nomme (connexion dediee) ; null si une autre execution le detient.
async function withLock(work) {
    const connection = await db.getConnection();
    try {
        const [[{ locked }]] = await connection.query("SELECT GET_LOCK(?, 0) AS locked", [LOCK_NAME]);
        if (locked !== 1) return null;
        try {
            return await work();
        } finally {
            await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => {});
        }
    } finally {
        connection.release();
    }
}

// Rapprochement a la demande (actor : membre de la finance).
exports.reconcile = async (actor, { source = "manual" } = {}) => {
    const summary = await withLock(() => run(actor, source));
    if (!summary) throw conflict("Un rapprochement est déjà en cours : réessayez dans quelques minutes", { code: "RECONCILE_RUNNING" });
    return summary;
};

// Derniere execution enregistree ({ at, source, durationMs, summary }) ou null.
exports.getLastRun = async () => {
    const raw = await settingsRepo.get(LAST_RUN_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (_error) {
        return null;
    }
};

// --- Worker planifie ---

let timer = null;
let firstRun = null;
let running = false;
let lastErrorLog = 0;

async function tick() {
    if (running) return;
    running = true;
    try {
        // Verrou detenu par une autre instance : cette execution est simplement sautee.
        await withLock(() => run(null, "worker"));
    } catch (error) {
        // Base indisponible : journal limite a 1 par 5 min.
        if (Date.now() - lastErrorLog > 5 * 60000) {
            lastErrorLog = Date.now();
            console.error("reconcile-worker:", error.message);
        }
    } finally {
        running = false;
    }
}

exports.tick = tick;

// Demarre le worker (jamais pendant les tests ni avec RECONCILE_WORKER=false).
exports.start = ({ intervalMs = INTERVAL_MS } = {}) => {
    if (timer || process.env.NODE_ENV === "test" || process.env.RECONCILE_WORKER === "false") return false;
    timer = setInterval(tick, Math.max(60 * 1000, intervalMs));
    timer.unref?.();
    firstRun = setTimeout(tick, FIRST_RUN_DELAY_MS);
    firstRun.unref?.();
    return true;
};

exports.stop = async () => {
    if (timer) clearInterval(timer);
    if (firstRun) clearTimeout(firstRun);
    timer = null;
    firstRun = null;
    // Laisse l'execution en cours se terminer (bornee par les timeouts des prestataires).
    const deadline = Date.now() + 15000;
    while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
};
