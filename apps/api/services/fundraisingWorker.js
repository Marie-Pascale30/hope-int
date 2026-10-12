// Fabrique des taches planifiees de la collecte de fonds (workers/fundraising-*.js) : intervalle,
// verrou MySQL nomme (une seule instance a la fois), inactives en test et desactivables par
// variable d'environnement (<envVar>=false).
const db = require("../config/db");

async function withLock(lockName, work) {
    const connection = await db.getConnection();
    try {
        const [[{ locked }]] = await connection.query("SELECT GET_LOCK(?, 0) AS locked", [lockName]);
        if (locked !== 1) return null;
        try {
            return await work();
        } finally {
            await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
        }
    } finally {
        connection.release();
    }
}

function createWorker({ name, envVar, intervalMs, firstRunDelayMs = 90 * 1000, run }) {
    let timer = null;
    let firstRun = null;
    let running = false;
    let lastErrorLog = 0;

    async function tick() {
        if (running) return null;
        running = true;
        try {
            return await withLock(`hope_${name}`, run);
        } catch (error) {
            // Base indisponible ou migration absente : journal limite a 1 par 5 min.
            if (Date.now() - lastErrorLog > 5 * 60000) {
                lastErrorLog = Date.now();
                console.error(`${name}:`, error.message);
            }
            return null;
        } finally {
            running = false;
        }
    }

    return {
        name,
        tick,
        start() {
            if (timer || process.env.NODE_ENV === "test" || process.env[envVar] === "false") return false;
            timer = setInterval(tick, Math.max(60 * 1000, intervalMs));
            timer.unref?.();
            firstRun = setTimeout(tick, firstRunDelayMs);
            firstRun.unref?.();
            return true;
        },
        async stop() {
            if (timer) clearInterval(timer);
            if (firstRun) clearTimeout(firstRun);
            timer = null;
            firstRun = null;
            const deadline = Date.now() + 15000;
            while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
        },
    };
}

module.exports = { createWorker, withLock };
