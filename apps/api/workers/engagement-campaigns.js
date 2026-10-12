// Envoi progressif des campagnes en cours : un lot de destinataires (CAMPAIGN_BATCH_SIZE) est mis
// dans la file email_outbox a chaque passage, la file les envoie ensuite avec nouvelles tentatives.
// Inactif en test ; CAMPAIGN_WORKER=false le desactive.
const campaignService = require("../services/campaignService");

let timer = null;
let running = null;
let lastErrorLog = 0;

async function tick() {
    if (running) return;
    running = campaignService.processPending()
        .catch((error) => {
            if (Date.now() - lastErrorLog > 5 * 60000) {
                lastErrorLog = Date.now();
                console.error("campaign-worker:", error.message);
            }
        })
        .finally(() => { running = null; });
    await running;
}

module.exports = {
    name: "engagement-campaigns",
    start() {
        if (timer || process.env.NODE_ENV === "test" || process.env.CAMPAIGN_WORKER === "false") return false;
        timer = setInterval(tick, Number(process.env.CAMPAIGN_INTERVAL_MS || 60000));
        timer.unref?.();
        return true;
    },
    async stop() {
        if (timer) clearInterval(timer);
        timer = null;
        if (running) await running;
    },
};
