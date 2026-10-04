const crypto = require("crypto");

// Notch Pay (Mobile Money Orange / MTN Cameroun en XAF), page de paiement hebergee.
// Doc : https://developer.notchpay.co/accept-payments/collect
const API_URL = "https://api.notchpay.co";

const publicKey = process.env.NOTCHPAY_PUBLIC_KEY || "";
// Cle privee facultative : envoyee en X-Grant pour les operations sensibles.
const privateKey = process.env.NOTCHPAY_PRIVATE_KEY || "";
// Formats rencontres : "pk_test.xxx", "pk.xxx", "pk_test_xxx".
const enabled = /^pk(_test)?[._]/.test(publicKey) && !/x{4,}/i.test(publicKey);

async function call(path, options = {}) {
    if (!enabled) {
        const error = new Error("Le paiement Mobile Money n'est pas configuré sur le serveur");
        error.status = 503;
        throw error;
    }
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: publicKey,
            ...(privateKey ? { "X-Grant": privateKey } : {}),
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(body.message || "Erreur du prestataire Mobile Money");
        error.status = response.status === 404 ? 404 : 502;
        throw error;
    }
    return body;
}

exports.isEnabled = () => enabled;

// Renvoie la reference Notch Pay (servant a la verification) et l'URL de paiement.
exports.createPaymentLink = async ({ reference, amount, currency, callbackUrl, donorEmail, donorName, phone, description }) => {
    const body = await call("/payments", {
        method: "POST",
        body: JSON.stringify({
            amount: Number(amount),
            currency: currency.toUpperCase(),
            email: donorEmail,
            phone: phone || undefined,
            customer: { name: donorName, email: donorEmail, phone: phone || undefined },
            description,
            reference,
            callback: callbackUrl,
            locked_country: "CM",
        }),
    });
    const transaction = body.transaction;
    return {
        transactionId: (typeof transaction === "object" && transaction?.reference) || reference,
        redirectUrl: body.authorization_url,
    };
};

// Statut normalise, toujours relu aupres de Notch Pay (jamais depuis les parametres du navigateur).
exports.verifyTransaction = async (reference) => {
    const body = await call(`/payments/${encodeURIComponent(reference)}`);
    const transaction = body.transaction || {};
    return {
        reference: transaction.reference,
        merchantReference: transaction.merchant_reference || transaction.trxref,
        status: transaction.status,
        amount: Number(transaction.amount),
        currency: String(transaction.currency || "").toLowerCase(),
    };
};

const STATUS_MAP = {
    complete: "succeeded",
    failed: "failed",
    rejected: "failed",
    canceled: "canceled",
    expired: "canceled",
    abandoned: "canceled",
    // Paiement rembourse depuis le tableau de bord Notch Pay (statut renvoye a la relecture).
    refunded: "refunded",
};

exports.toPaymentStatus = (status) => STATUS_MAP[status] || null;

// Signature HMAC-SHA256 du corps brut avec la cle de hachage (Business suite > Settings > API Keys).
exports.isValidWebhook = (rawBody, signature) => {
    const hash = process.env.NOTCHPAY_WEBHOOK_HASH;
    if (!hash || !signature || !rawBody) return false;
    const expected = crypto.createHmac("sha256", hash).update(rawBody).digest("hex");
    const given = Buffer.from(String(signature));
    const wanted = Buffer.from(expected);
    return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
};
