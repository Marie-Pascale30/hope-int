// Dons : creation chez le prestataire, page de remerciement, recus, validation manuelle et listes.
const paymentRepo = require("../../repositories/paymentRepository");
const contentRepo = require("../../repositories/contentRepository");
const stripeProvider = require("./stripeProvider");
const flutterwaveProvider = require("./flutterwaveProvider");
const notchpayProvider = require("./notchpayProvider");
const receiptService = require("../receiptService");
const logService = require("../activityLogService");
const { REFRESHABLE_STATUSES, sendReceipt } = require("./statusService");
const { getMobileMoneyProvider, refreshPayment } = require("./refreshService");
const { DONATION_LIMITS } = require("@hope/shared/constants");
const { badRequest, conflict, notFound } = require("../../utils/httpError");
const { FRONTEND_URL, randomToken } = require("../../utils/security");

exports.getProviders = () => {
    const mobileMoneyProvider = getMobileMoneyProvider();
    return {
        stripe: stripeProvider.isEnabled(),
        mobileMoney: Boolean(mobileMoneyProvider),
        mobileMoneyProvider,
        notchpay: notchpayProvider.isEnabled(),
        flutterwave: flutterwaveProvider.isEnabled(),
    };
};

// Vue publique d'un don (page de remerciement, espace membre) : pas d'identifiants internes.
function toPublicView(payment) {
    return {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        provider: payment.provider,
        frequency: payment.frequency,
        project_id: payment.project_id,
        project_title: payment.project_title,
        donor_name: payment.donor_name,
        receipt_number: payment.receipt_number,
        receipt_token: payment.receipt_token,
        subscription_id: payment.subscription_id,
        subscription_status: payment.subscription_status || null,
        refunded_amount: payment.refunded_amount || 0,
        paid_at: payment.paid_at,
        created_at: payment.created_at,
    };
}

exports.toPublicView = toPublicView;

// Montant arrondi a la precision de la devise (FCFA sans decimales).
function roundAmount(amount, currency) {
    return currency === "xaf" ? Math.round(Number(amount)) : Math.round(Number(amount) * 100) / 100;
}

// Renvoi d'un recu (ex. receipt_sent_at vide apres une panne SMTP).
exports.resendReceipt = async (paymentId, actor) => {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw notFound("Don introuvable");
    if (payment.status !== "succeeded" || !payment.receipt_number) throw badRequest("Aucun reçu valide pour ce don");
    await sendReceipt(payment.id);
    if (actor) {
        await logService.log({ userId: actor.id, action: "payment.receipt_resent", meta: { paymentId: payment.id } });
    }
};

// Don en verification (montant ou devise incoherents) : decision manuelle apres controle chez le
// prestataire. Hors machine d'etats automatique, pour qu'aucun webhook ne valide seul un tel don.
// Validation : receivedAmount (montant reellement encaisse) remplace le montant attendu, dans la
// meme transaction que l'emission du recu, pour que le recu porte le montant confirme.
exports.resolveReview = async (actor, paymentId, { decision, note, receivedAmount }) => {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw notFound("Don introuvable");
    if (payment.status !== "review") throw badRequest("Ce don n'est pas en attente de vérification");

    const meta = { paymentId: payment.id, note: note || null };
    if (decision === "approve") {
        const received = roundAmount(receivedAmount, payment.currency);
        if (!(received > 0)) throw badRequest("Indiquez le montant réellement reçu");
        const result = await paymentRepo.markSucceeded(payment.id, {
            fromStatuses: ["review"],
            yearOf: receiptService.receiptYear,
            amount: received,
        });
        if (!result.changed) throw conflict("Ce don vient d'être traité par ailleurs");
        if (result.issued) sendReceipt(payment.id);
        Object.assign(meta, {
            amount: received,
            currency: payment.currency,
            expected: { amount: payment.amount, currency: payment.currency },
            received: { amount: received, currency: payment.currency },
        });
    } else {
        const changed = await paymentRepo.transitionStatus(payment.id, "canceled", ["review"]);
        if (!changed) throw conflict("Ce don vient d'être traité par ailleurs");
        Object.assign(meta, { amount: payment.amount, currency: payment.currency });
    }

    await logService.log({
        userId: actor.id,
        action: decision === "approve" ? "payment.review_approved" : "payment.review_rejected",
        meta,
    });
    return paymentRepo.findById(payment.id);
};

async function resolveProject(projectId) {
    if (!projectId) return null;
    const project = await contentRepo.getById("projects", projectId, { publishedOnly: true });
    if (!project) throw badRequest("Projet introuvable");
    if (project.status === "termine") throw badRequest("Ce projet est terminé : il ne reçoit plus de dons");
    return project;
}

exports.createDonation = async (user, input) => {
    // "mobile_money" (ou un prestataire Mobile Money nomme) -> prestataire Mobile Money actif.
    const provider = input.provider === "stripe" ? "stripe" : getMobileMoneyProvider();
    const currency = provider === "stripe" ? "eur" : "xaf";
    const frequency = input.frequency === "monthly" ? "monthly" : "once";
    const amount = roundAmount(input.amount, currency);

    const limits = DONATION_LIMITS[currency];
    if (!(amount >= limits.min && amount <= limits.max)) {
        throw badRequest(`Le montant doit être compris entre ${limits.min} et ${limits.max} ${currency.toUpperCase()}`);
    }
    if (frequency === "monthly" && provider !== "stripe") {
        throw badRequest("Le don mensuel est disponible uniquement par carte bancaire");
    }
    if (!provider || (provider === "stripe" && !stripeProvider.isEnabled())) {
        throw Object.assign(new Error("Ce moyen de paiement n'est pas encore disponible"), { status: 503 });
    }

    const donorName = user?.name || String(input.donorName || "").trim();
    const donorEmail = user?.email || String(input.donorEmail || "").trim().toLowerCase();
    if (!donorName || !donorEmail) throw badRequest("Nom et email du donateur obligatoires");

    const project = await resolveProject(input.projectId);
    const receiptToken = randomToken(24);

    const paymentId = await paymentRepo.create({
        userId: user?.id,
        amount,
        currency,
        method: provider === "stripe" ? "card" : "mobile_money",
        provider,
        status: "pending",
        donorName,
        donorEmail,
        projectId: project?.id,
        frequency,
        subscriptionStatus: frequency === "monthly" ? "incomplete" : null,
        receiptToken,
    });

    const response = { paymentId, provider, receiptToken };

    try {
        if (provider === "stripe") {
            const result = frequency === "monthly"
                ? await stripeProvider.createMonthlySubscription({ amount, currency, paymentId, projectId: project?.id, donorEmail, donorName })
                : await stripeProvider.createOneTimeIntent({ amount, currency, paymentId, projectId: project?.id });
            await paymentRepo.setTransactionId(paymentId, result.transactionId, result.subscriptionId);
            response.clientSecret = result.clientSecret;
        } else if (provider === "notchpay") {
            const result = await notchpayProvider.createPaymentLink({
                reference: `HOPE-${paymentId}-${randomToken(4)}`,
                amount,
                currency,
                callbackUrl: `${FRONTEND_URL}/don/merci?ref=${receiptToken}`,
                donorEmail,
                donorName,
                phone: input.phone,
                description: project ? `Don pour : ${project.title}` : "Don à HOPE International",
            });
            await paymentRepo.setTransactionId(paymentId, result.transactionId);
            response.redirectUrl = result.redirectUrl;
        } else {
            const txRef = `HOPE-${paymentId}-${randomToken(4)}`;
            await paymentRepo.setTransactionId(paymentId, txRef);
            response.redirectUrl = await flutterwaveProvider.createPaymentLink({
                txRef,
                amount,
                currency,
                redirectUrl: `${FRONTEND_URL}/don/merci?ref=${receiptToken}`,
                donorEmail,
                donorName,
                phone: input.phone,
                description: project ? `Don pour : ${project.title}` : "Don à HOPE International",
            });
        }
    } catch (error) {
        await paymentRepo.transitionStatus(paymentId, "failed", ["pending"]);
        throw error;
    }

    await logService.log({
        userId: user?.id || null,
        action: "payment.initiated",
        meta: { paymentId, provider, amount, currency, frequency, projectId: project?.id || null },
    });
    return response;
};

// Appelee par la page de remerciement : le statut est toujours relu aupres du prestataire,
// jamais deduit des parametres du navigateur (un retour "cancelled" laisse le don en attente).
exports.confirmByReceiptToken = async (token, { transactionId } = {}) => {
    const payment = await paymentRepo.findByReceiptToken(token);
    if (!payment) throw notFound("Don introuvable");

    if (REFRESHABLE_STATUSES.includes(payment.status)) {
        await refreshPayment(payment, { transactionId, source: "client_confirm" });
    }
    return toPublicView(await paymentRepo.findById(payment.id));
};

exports.getByReceiptToken = async (token) => {
    const payment = await paymentRepo.findByReceiptToken(token);
    if (!payment) throw notFound("Don introuvable");
    return toPublicView(payment);
};

exports.getReceiptPdf = async (token) => {
    const payment = await paymentRepo.findByReceiptToken(token);
    if (!payment) throw notFound("Reçu introuvable");
    if (payment.status === "refunded") {
        throw badRequest("Ce don a été remboursé : son reçu a été annulé et ne peut plus être téléchargé.", { code: "RECEIPT_REVOKED" });
    }
    if (payment.status === "disputed") {
        throw badRequest("Ce don fait l'objet d'une contestation bancaire : son reçu est suspendu jusqu'à la clôture du litige.", { code: "RECEIPT_SUSPENDED" });
    }
    if (payment.status === "review") {
        throw badRequest("Ce don est en cours de vérification par notre équipe : le reçu sera disponible après validation.", { code: "PAYMENT_UNDER_REVIEW" });
    }
    if (payment.status !== "succeeded" || !payment.receipt_number) {
        throw badRequest("Le reçu sera disponible une fois le paiement confirmé");
    }
    return { buffer: await receiptService.generate(payment), receiptNumber: payment.receipt_number };
};

// Recapitulatif annuel des dons confirmes du compte (annee civile dans RECEIPT_TIMEZONE).
exports.getAnnualReceiptPdf = async (user, year) => {
    const value = Number(year);
    const currentYear = receiptService.receiptYear(new Date());
    if (!Number.isInteger(value) || value < 2000 || value > currentYear) throw badRequest("Année invalide");
    const { from, to } = receiptService.yearBounds(value);
    const payments = await paymentRepo.getSucceededByUserBetween(user.id, from, to);
    if (!payments.length) throw notFound(`Aucun don confirmé en ${value}`);
    const buffer = await receiptService.generateAnnual({ year: value, donorName: user.name, donorEmail: user.email, payments });
    await logService.log({ userId: user.id, action: "payment.annual_receipt", meta: { year: value, count: payments.length } });
    return { buffer, year: value };
};

// Liste d'administration : { rows, total } (page demandee, ou les plus recents sans pagination).
exports.getAll = async (filters, pagination = null) => paymentRepo.getAll(filters, pagination);
exports.getForExport = async (filters) => paymentRepo.getForExport(filters);
// Bilan : l'annee est convertie en bornes du fuseau des recus par le repository.
exports.getSummary = async (filters) => paymentRepo.getSummary(filters);
