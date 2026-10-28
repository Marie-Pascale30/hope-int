const crypto = require("crypto");

// Flutterwave (Mobile Money Orange / MTN et carte en XAF), via l'API REST v3.
const API_URL = "https://api.flutterwave.com/v3";

const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || "";
const enabled = /^FLWSECK/.test(secretKey) && !/x{4,}/i.test(secretKey);

async function call(path, options = {}) {
    if (!enabled) {
        const error = new Error("Le paiement Mobile Money n'est pas configuré sur le serveur");
        error.status = 503;
        throw error;
    }
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.status === "error") {
        const error = new Error(body.message || "Erreur du prestataire Mobile Money");
        error.status = 502;
        throw error;
    }
    return body.data;
}

exports.isEnabled = () => enabled;

exports.createPaymentLink = async ({ txRef, amount, currency, redirectUrl, donorEmail, donorName, phone, description }) => {
    const data = await call("/payments", {
        method: "POST",
        body: JSON.stringify({
            tx_ref: txRef,
            amount: Number(amount),
            currency: currency.toUpperCase(),
            redirect_url: redirectUrl,
            payment_options: "mobilemoneyfranco,card",
            customer: { email: donorEmail, name: donorName, phonenumber: phone || undefined },
            customizations: { title: "HOPE International Project", description },
        }),
    });
    return data.link;
};

// Statut normalise d'une transaction, toujours relu aupres de Flutterwave (jamais depuis le client).
exports.verifyTransaction = async ({ transactionId, txRef }) => {
    const data = transactionId
        ? await call(`/transactions/${encodeURIComponent(transactionId)}/verify`)
        : await call(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`);
    return {
        txRef: data.tx_ref,
        status: data.status, // successful | failed | pending
        amount: Number(data.amount),
        currency: String(data.currency || "").toLowerCase(),
        // Date de la transaction chez Flutterwave (champ created_at de la reponse de verification).
        paidAt: data.created_at || null,
    };
};

// En-tete verif-hash compare en temps constant a la valeur configuree.
exports.isValidWebhook = (headers) => {
    const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    const given = headers?.["verif-hash"];
    if (!expected || typeof given !== "string") return false;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};
