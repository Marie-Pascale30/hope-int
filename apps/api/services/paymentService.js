// Facade des paiements : l'API publique historique, repartie en modules dans services/payments/
// (dons et recus, webhooks, abonnements, rapprochement). Les appelants n'importent que ce fichier.
const donationService = require("./payments/donationService");
const webhookService = require("./payments/webhookService");
const subscriptionService = require("./payments/subscriptionService");
const reconcileService = require("./payments/reconcileService");
const { TRANSITIONS } = require("./payments/statusService");

module.exports = {
    // Dons et recus
    getProviders: donationService.getProviders,
    createDonation: donationService.createDonation,
    confirmByReceiptToken: donationService.confirmByReceiptToken,
    getByReceiptToken: donationService.getByReceiptToken,
    getReceiptPdf: donationService.getReceiptPdf,
    getAnnualReceiptPdf: donationService.getAnnualReceiptPdf,
    resendReceipt: donationService.resendReceipt,
    resolveReview: donationService.resolveReview,
    getAll: donationService.getAll,
    getForExport: donationService.getForExport,
    getSummary: donationService.getSummary,
    // Webhooks
    handleStripeWebhook: webhookService.handleStripeWebhook,
    handleNotchpayWebhook: webhookService.handleNotchpayWebhook,
    handleFlutterwaveWebhook: webhookService.handleFlutterwaveWebhook,
    // Dons mensuels
    getForUser: subscriptionService.getForUser,
    cancelSubscription: subscriptionService.cancelSubscription,
    cancelSubscriptionByReceiptToken: subscriptionService.cancelSubscriptionByReceiptToken,
    // Rapprochement
    reconcile: reconcileService.reconcile,
    getLastReconcile: reconcileService.getLastRun,
    TRANSITIONS,
};
