// Etat detaille de l'API (supervision) : base, migrations, file d'emails, rapprochement.
const statsRepo = require("../repositories/statsRepository");
const outboxRepo = require("../repositories/emailOutboxRepository");
const { status: migrationStatus } = require("../config/migrate");
const reconcileService = require("./payments/reconcileService");

// Un email en attente depuis plus longtemps signale un worker arrete ou un SMTP en panne.
const STALE_EMAIL_MINUTES = 30;

async function section(work) {
    try {
        return { ok: true, ...(await work()) };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

exports.getDetails = async () => {
    const database = await section(() => statsRepo.getDatabaseInfo());
    const migrations = await section(async () => {
        const states = await migrationStatus();
        const applied = states.filter((migration) => migration.applied);
        return {
            latest: applied.at(-1)?.name || null,
            applied: applied.length,
            pending: states.filter((migration) => !migration.applied).map((migration) => migration.name),
        };
    });
    const emailOutbox = await section(async () => {
        const health = await outboxRepo.getHealth();
        return { ...health, stale: health.oldestPendingMinutes !== null && health.oldestPendingMinutes > STALE_EMAIL_MINUTES };
    });
    const reconcile = await section(async () => ({ lastRun: await reconcileService.getLastRun() }));

    const ok = database.ok && migrations.ok && migrations.pending.length === 0;
    return {
        status: ok ? "ok" : "degraded",
        uptimeSeconds: Math.round(process.uptime()),
        database,
        migrations,
        emailOutbox,
        reconcile,
        checkedAt: new Date().toISOString(),
    };
};
