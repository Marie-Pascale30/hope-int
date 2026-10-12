// Rappels des evenements (la veille) : passage periodique.
// EVENT_REMINDER_WORKER=false le desactive sur une instance ; EVENT_REMINDER_INTERVAL_MS regle la
// frequence (defaut 15 min) ; EVENT_REMINDER_LEAD_HOURS le delai avant l'evenement (defaut 24 h).
// Jamais actif pendant les tests (ils appellent sendDueReminders directement).
const reminders = require("../services/volunteerReminders");

let timer = null;
let running = false;
let lastErrorLog = 0;

async function tick() {
    if (running) return;
    running = true;
    try {
        await reminders.sendDueReminders();
    } catch (error) {
        // Base indisponible ou migration non appliquee : journal limite a 1 par 5 min.
        if (Date.now() - lastErrorLog > 5 * 60000) {
            lastErrorLog = Date.now();
            console.error("event-reminder-worker:", error.message);
        }
    } finally {
        running = false;
    }
}

module.exports = {
    name: "volunteering-reminders",
    start() {
        if (timer || process.env.NODE_ENV === "test" || process.env.EVENT_REMINDER_WORKER === "false") return false;
        const interval = Number(process.env.EVENT_REMINDER_INTERVAL_MS) || 15 * 60 * 1000;
        timer = setInterval(tick, Math.max(60 * 1000, interval));
        timer.unref?.();
        tick();
        return true;
    },
    async stop() {
        if (timer) clearInterval(timer);
        timer = null;
        const deadline = Date.now() + 10000;
        while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    },
};
