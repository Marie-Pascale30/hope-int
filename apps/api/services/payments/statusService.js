// Machine d'etats des dons et emission des recus, partagees par les dons, les webhooks et le
// rapprochement.
const paymentRepo = require("../../repositories/paymentRepository");
const receiptService = require("../receiptService");
const logService = require("../activityLogService");
const { sendDonationReceiptEmail } = require("../emailService");

const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/$/, "");

// Machine d'etats : pour chaque statut cible, statuts d'origine autorises. La transition est
// appliquee atomiquement par MySQL (UPDATE ... WHERE status IN (...)).
// - un don reussi ne redevient jamais en attente / echoue / annule ;
// - succeeded -> refunded / disputed (remboursement, litige) ; disputed -> succeeded (litige gagne) ;
// - review (montant ou devise incoherents) se traite manuellement.
const TRANSITIONS = {
    succeeded: ["pending", "failed", "canceled", "disputed"],
    failed: ["pending"],
    canceled: ["pending", "failed"],
    review: ["pending", "failed", "canceled"],
    disputed: ["succeeded"],
    refunded: ["succeeded", "disputed", "review"],
};

// Statuts relus aupres du prestataire (page de remerciement, webhooks Mobile Money).
const REFRESHABLE_STATUSES = ["pending", "failed", "canceled"];

async function sendReceipt(paymentId) {
    try {
        const payment = await paymentRepo.findById(paymentId);
        if (!payment?.receipt_number || payment.status !== "succeeded") return;
        const view = receiptService.receiptView(payment);
        if (!view.donorEmail) return;
        const pdfBuffer = await receiptService.generate(payment);
        await sendDonationReceiptEmail({
            to: view.donorEmail,
            fullName: view.donorName,
            amountLabel: receiptService.formatAmount(view.amount, view.currency),
            receiptNumber: payment.receipt_number,
            receiptUrl: `${API_PUBLIC_URL}/payment/receipts/${payment.receipt_token}/pdf`,
            pdfBuffer,
            paymentId: payment.id,
        });
    } catch (error) {
        console.error("receipt-email-error:", error.message);
    }
}

// Applique un changement de statut si la machine d'etats l'autorise. Renvoie true si applique.
// extra.paidAt : date reelle du paiement chez le prestataire (annee du recu).
async function applyStatus(payment, status, source, extra = {}) {
    if (!payment || payment.status === status) return false;
    if (status === "succeeded") {
        const result = await paymentRepo.markSucceeded(payment.id, {
            fromStatuses: TRANSITIONS.succeeded,
            yearOf: receiptService.receiptYear,
            paidAt: extra.paidAt,
        });
        if (!result.changed) return false;
        await logService.log({
            userId: payment.user_id,
            action: payment.status === "disputed" ? "payment.dispute_won" : "payment.succeeded",
            meta: { paymentId: payment.id, amount: payment.amount, currency: payment.currency, source, previous: payment.status },
        });
        if (payment.subscription_id) {
            await paymentRepo.setSubscriptionStatus(payment.subscription_id, "active", { onlyIf: ["incomplete"] });
        }
        if (result.issued) sendReceipt(payment.id);
        return true;
    }

    const changed = await paymentRepo.transitionStatus(
        payment.id,
        status,
        TRANSITIONS[status],
        extra.refundedAmount !== undefined ? { refundedAmount: extra.refundedAmount } : {}
    );
    if (!changed) return false;
    await logService.log({
        userId: payment.user_id,
        action: extra.action || `payment.${status}`,
        meta: { paymentId: payment.id, source, previous: payment.status, ...(extra.meta || {}) },
    });
    if (status === "refunded" && payment.receipt_number) {
        await logService.log({
            userId: payment.user_id,
            action: "payment.receipt_revoked",
            meta: { paymentId: payment.id, receiptNumber: payment.receipt_number, source },
        });
    }
    return true;
}

// Montant ou devise confirmes par le prestataire differents du don : a traiter manuellement.
async function flagForReview(payment, result, source) {
    await logService.log({
        userId: payment.user_id,
        action: "payment.amount_mismatch",
        meta: {
            paymentId: payment.id,
            source,
            expected: { amount: payment.amount, currency: payment.currency },
            received: { amount: result.amount, currency: result.currency, status: result.status },
        },
    });
    await applyStatus(payment, "review", source);
}

module.exports = { API_PUBLIC_URL, TRANSITIONS, REFRESHABLE_STATUSES, sendReceipt, applyStatus, flagForReview };
