// Recapitulatifs fiscaux annuels envoyes en janvier, par lots. Desactivable :
// ANNUAL_SUMMARY_WORKER=false ; frequence : ANNUAL_SUMMARY_INTERVAL_MS (defaut 10 min).
const { createWorker } = require("../services/fundraisingWorker");
const annualService = require("../services/donationAnnualService");

module.exports = createWorker({
    name: "fundraising-annual",
    envVar: "ANNUAL_SUMMARY_WORKER",
    intervalMs: Number(process.env.ANNUAL_SUMMARY_INTERVAL_MS || 10 * 60 * 1000),
    run: () => annualService.runScheduled(),
});
