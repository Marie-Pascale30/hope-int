// Suivi des erreurs (Sentry), optionnel : inactif tant que SENTRY_DSN n'est pas defini.
//
// Integration (voir README, section Outillage) :
//   1. server.js, PREMIERE ligne apres dotenv (avant require("./app")) : require("./config/sentry");
//      Sentry instrumente Express/HTTP/MySQL au chargement : il doit etre initialise avant eux.
//   2. app.js, apres les routes et AVANT le handler d'erreur maison :
//        require("./config/sentry").setupErrorHandler(app);
//
// Variables : SENTRY_DSN, SENTRY_ENVIRONMENT (defaut NODE_ENV), SENTRY_TRACES_SAMPLE_RATE (defaut 0),
// SENTRY_RELEASE (ex. SHA du commit, fourni par l'image Docker).
const dsn = process.env.SENTRY_DSN;
const enabled = Boolean(dsn) && process.env.NODE_ENV !== "test";

let Sentry = null;

// En-tetes et champs jamais transmis a Sentry.
const SENSITIVE_HEADERS = ["cookie", "authorization", "x-api-key"];
const SENSITIVE_FIELDS = /pass(word)?|token|secret|email|phone/i;

function scrub(event) {
    const request = event.request;
    if (request) {
        if (request.headers) {
            for (const name of Object.keys(request.headers)) {
                if (SENSITIVE_HEADERS.includes(name.toLowerCase())) request.headers[name] = "[masque]";
            }
        }
        delete request.cookies;
        if (request.query_string) request.query_string = "[masque]";
        if (request.data && typeof request.data === "object") {
            for (const key of Object.keys(request.data)) {
                if (SENSITIVE_FIELDS.test(key)) request.data[key] = "[masque]";
            }
        }
    }
    if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
    return event;
}

if (enabled) {
    Sentry = require("@sentry/node");
    Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
        release: process.env.SENTRY_RELEASE || undefined,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
        sendDefaultPii: false,
        beforeSend: scrub,
    });
}

/** Branche le handler d'erreurs Sentry (erreurs 5xx) ; sans effet si Sentry est inactif. */
function setupErrorHandler(app) {
    if (Sentry) Sentry.setupExpressErrorHandler(app);
}

module.exports = { enabled, setupErrorHandler, scrub };
