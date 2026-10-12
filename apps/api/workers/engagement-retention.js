// Purge quotidienne des donnees arrivees au terme de leur duree de conservation
// (voir services/privacyRetentionService.js). Inactive en test ; RETENTION_WORKER=false la desactive.
const retention = require("../services/privacyRetentionService");

const DAY_MS = 24 * 3600 * 1000;
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000;

let firstTimer = null;
let timer = null;
let running = null;

async function tick() {
    if (running) return;
    running = retention.runPurge()
        .catch((error) => console.error("retention-worker:", error.message))
        .finally(() => { running = null; });
    await running;
}

module.exports = {
    name: "engagement-retention",
    start() {
        if (timer || firstTimer || process.env.NODE_ENV === "test" || process.env.RETENTION_WORKER === "false") return false;
        firstTimer = setTimeout(tick, FIRST_RUN_DELAY_MS);
        firstTimer.unref?.();
        timer = setInterval(tick, Number(process.env.RETENTION_INTERVAL_MS || DAY_MS));
        timer.unref?.();
        return true;
    },
    async stop() {
        if (firstTimer) clearTimeout(firstTimer);
        if (timer) clearInterval(timer);
        firstTimer = null;
        timer = null;
        if (running) await running;
    },
};
