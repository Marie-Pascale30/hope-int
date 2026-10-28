// Verification de la configuration au demarrage en production : les erreurs empechent le demarrage
// (secret faible, URL non HTTPS, SMTP absent alors que les codes de connexion de l'equipe partent par
// email...), les avertissements signalent ce qui manque sans bloquer (cles de paiement de test,
// supervision). Fonction pure : testee sans demarrer le serveur.

const isHttps = (value) => {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
};

function checkProductionConfig(env = process.env) {
    const errors = [];
    const warnings = [];

    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
        errors.push("JWT_SECRET doit contenir au moins 32 caractères.");
    }
    for (const key of ["FRONTEND_URL", "API_PUBLIC_URL"]) {
        if (!isHttps(env[key])) errors.push(`${key} doit être une URL en https (ex. https://hopeintapp.com).`);
    }
    const origins = (env.CORS_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean);
    if (!origins.length || origins.some((origin) => !isHttps(origin))) {
        errors.push("CORS_ORIGIN doit lister les origines du site en https.");
    }
    if (env.COOKIE_SECURE === "false") errors.push("COOKIE_SECURE=false est interdit en production.");
    if (!env.DB_PASSWORD) errors.push("DB_PASSWORD est vide.");
    // Recus, mots de passe oublies et codes de connexion de l'equipe passent par email.
    if (!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS)) {
        errors.push("SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASS sont obligatoires (aucun email ne partirait).");
    }

    if (!env.STRIPE_SECRET_KEY) warnings.push("STRIPE_SECRET_KEY absent : dons par carte indisponibles.");
    else if (env.STRIPE_SECRET_KEY.startsWith("sk_test_")) warnings.push("STRIPE_SECRET_KEY est une clé de TEST.");
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
        warnings.push("STRIPE_WEBHOOK_SECRET absent : les paiements par carte ne seront pas confirmés.");
    }
    if (!env.NOTCHPAY_PRIVATE_KEY && !env.FLUTTERWAVE_SECRET_KEY) {
        warnings.push("Aucune clé Notch Pay ni Flutterwave : dons Mobile Money indisponibles.");
    }
    // Sinon derive de JWT_SECRET : changer JWT_SECRET invaliderait les liens de preferences deja envoyes.
    if (!env.ENGAGEMENT_TOKEN_SECRET || env.ENGAGEMENT_TOKEN_SECRET.length < 32) {
        warnings.push("ENGAGEMENT_TOKEN_SECRET absent : les liens de préférences dépendent de JWT_SECRET.");
    }
    if (!env.SENTRY_DSN) warnings.push("SENTRY_DSN absent : les erreurs ne seront pas remontées.");
    if (!env.TRUST_PROXY) warnings.push("TRUST_PROXY absent : à définir si l'API est derrière un proxy (adresses IP, HTTPS).");

    return { errors, warnings };
}

// Au demarrage : journalise les avertissements, arrete le processus en cas d'erreur.
function assertProductionConfig(env = process.env) {
    const { errors, warnings } = checkProductionConfig(env);
    for (const warning of warnings) console.warn(`Configuration : ${warning}`);
    if (errors.length) {
        console.error(`Configuration de production invalide :\n- ${errors.join("\n- ")}`);
        process.exit(1);
    }
}

module.exports = { checkProductionConfig, assertProductionConfig };
