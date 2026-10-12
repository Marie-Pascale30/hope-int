// Relance des paiements abandonnes (2 h puis 24 h). Desactivable : DONATION_REMINDER_WORKER=false ;
// frequence : DONATION_REMINDER_INTERVAL_MS (defaut 15 min).
const { createWorker } = require("../services/fundraisingWorker");
const reminderService = require("../services/donationReminderService");

module.exports = createWorker({
    name: "fundraising-reminders",
    envVar: "DONATION_REMINDER_WORKER",
    intervalMs: Number(process.env.DONATION_REMINDER_INTERVAL_MS || 15 * 60 * 1000),
    run: () => reminderService.run(),
});
