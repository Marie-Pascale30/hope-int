// Rappels mensuels des engagements de don Mobile Money. Desactivable : PLEDGE_REMINDER_WORKER=false ;
// frequence : PLEDGE_REMINDER_INTERVAL_MS (defaut 1 h).
const { createWorker } = require("../services/fundraisingWorker");
const pledgeService = require("../services/donationPledgeService");

module.exports = createWorker({
    name: "fundraising-pledges",
    envVar: "PLEDGE_REMINDER_WORKER",
    intervalMs: Number(process.env.PLEDGE_REMINDER_INTERVAL_MS || 60 * 60 * 1000),
    run: () => pledgeService.runReminders(),
});
