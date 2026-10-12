// Indicateurs de collecte pour la page Finance : ventilation des dons par source, dons mensuels
// Stripe (MRR, attrition), engagements Mobile Money et dons hors ligne en attente.
const fundraisingRepo = require("../repositories/fundraisingRepository");
const offlineRepo = require("../repositories/donationOfflineRepository");
const pledgeService = require("./donationPledgeService");
const annualService = require("./donationAnnualService");
const receiptService = require("./receiptService");
const { getScopeRegion } = require("../utils/scope");

exports.getInsights = async (actor, { year } = {}) => {
    const region = getScopeRegion(actor);
    const scope = region ? { region } : {};
    const [bySource, recurring, pledges, offlinePending] = await Promise.all([
        fundraisingRepo.getBySource({ year, ...scope }),
        fundraisingRepo.getRecurringStats(scope),
        pledgeService.list(actor, {}),
        offlineRepo.countPending(),
    ]);
    const activePledges = pledges.filter((pledge) => pledge.status === "active");
    const paid = pledges.reduce((sum, pledge) => sum + pledge.regularity.paid, 0);
    const missed = pledges.reduce((sum, pledge) => sum + pledge.regularity.missed, 0);
    const lastYear = receiptService.receiptYear(new Date()) - 1;
    return {
        bySource,
        recurring,
        pledges: {
            active: activePledges.length,
            paused: pledges.filter((pledge) => pledge.status === "paused").length,
            monthlyXaf: activePledges.reduce((sum, pledge) => sum + pledge.amount, 0),
            paid,
            missed,
            rate: paid + missed ? Math.round((paid / (paid + missed)) * 100) : null,
        },
        offlinePending,
        annualSummaries: await annualService.status(lastYear),
    };
};
