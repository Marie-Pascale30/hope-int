const paymentService = require("../services/paymentService");

exports.createDonation = async (req, res) => {
    res.status(201).json(await paymentService.createDonation(req.user, req.body));
};

exports.getReceipt = async (req, res) => {
    res.json(await paymentService.getByReceiptToken(req.params.token));
};

exports.confirmReceipt = async (req, res) => {
    res.json(await paymentService.confirmByReceiptToken(req.params.token, {
        transactionId: req.body.transactionId,
        redirectStatus: req.body.status,
    }));
};

exports.downloadReceipt = async (req, res) => {
    const { buffer, receiptNumber } = await paymentService.getReceiptPdf(req.params.token);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="recu-${receiptNumber}.pdf"`);
    res.send(buffer);
};

exports.downloadAnnualReceipt = async (req, res) => {
    const { buffer, year } = await paymentService.getAnnualReceiptPdf(req.user, req.params.year);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="recapitulatif-dons-${year}.pdf"`);
    res.send(buffer);
};

exports.cancelSubscriptionByReceipt = async (req, res) => {
    const { alreadyCanceled } = await paymentService.cancelSubscriptionByReceiptToken(req.params.token);
    res.json({ message: alreadyCanceled ? "Ce don mensuel était déjà arrêté" : "Don mensuel arrêté", alreadyCanceled });
};

exports.getMine = async (req, res) => {
    res.json(await paymentService.getForUser(req.user));
};

exports.cancelSubscription = async (req, res) => {
    await paymentService.cancelSubscription(req.user, req.params.id);
    res.json({ message: "Don mensuel arrêté" });
};

exports.handleStripeWebhook = async (req, res) => {
    try {
        await paymentService.handleStripeWebhook(req.headers["stripe-signature"], req.body);
        res.json({ received: true });
    } catch (error) {
        console.error("stripe-webhook-error:", error.message);
        res.status(400).json({ error: "Webhook refusé" });
    }
};

exports.handleNotchpayWebhook = async (req, res) => {
    try {
        await paymentService.handleNotchpayWebhook(req.headers["x-notch-signature"], req.body);
        res.json({ received: true });
    } catch (error) {
        console.error("notchpay-webhook-error:", error.message);
        res.status(error.status === 403 ? 401 : 400).json({ error: "Webhook refusé" });
    }
};

exports.handleFlutterwaveWebhook = async (req, res) => {
    try {
        await paymentService.handleFlutterwaveWebhook(req.headers, req.body);
        res.json({ received: true });
    } catch (error) {
        console.error("flutterwave-webhook-error:", error.message);
        res.status(error.status === 403 ? 401 : 400).json({ error: "Webhook refusé" });
    }
};
