// Journalisation structuree (pino) : JSON en production (collecte par l'hebergeur / un agregateur),
// lisible en developpement (pino-pretty, devDependency), silencieuse pendant les tests.
//
//   const { logger, httpLogger } = require("./config/logger");
//   app.use(httpLogger);          // remplace morgan (une ligne par requete, req.log disponible)
//   logger.info({ paymentId }, "Don confirme");
//
// Variables : LOG_LEVEL (defaut info, debug en developpement), LOG_PRETTY=false pour garder le JSON en dev.
const crypto = require("crypto");
const pino = require("pino");
const pinoHttp = require("pino-http");

const env = process.env.NODE_ENV || "development";
const isProduction = env === "production";
const isTest = env === "test";

// Donnees personnelles et secrets jamais ecrits dans les journaux.
const REDACT_PATHS = [
    "req.headers.cookie",
    "req.headers.authorization",
    'req.headers["x-api-key"]',
    'res.headers["set-cookie"]',
    "*.password",
    "*.newPassword",
    "*.currentPassword",
    "*.token",
    "*.email",
    "*.donorEmail",
    "*.phone",
    "password",
    "email",
];

function prettyTransport() {
    if (isProduction || isTest || process.env.LOG_PRETTY === "false") return undefined;
    try {
        require.resolve("pino-pretty");
        return { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } };
    } catch {
        return undefined; // image de production sans devDependencies : JSON
    }
}

const logger = pino({
    level: process.env.LOG_LEVEL || (isTest ? "silent" : isProduction ? "info" : "debug"),
    base: { service: "hope-api", env },
    redact: { paths: REDACT_PATHS, censor: "[masque]" },
    transport: prettyTransport(),
});

// Les URL de recus, de reinitialisation et de webhooks portent des jetons : query string retiree.
const stripQuery = (url = "") => url.split("?")[0];

const httpLogger = pinoHttp({
    logger,
    genReqId(req, res) {
        const incoming = req.headers["x-request-id"];
        const id = typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
    },
    customLogLevel(_req, res, error) {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
    },
    // Sondes de sante (healthcheck Docker toutes les 30 s) : pas de bruit.
    autoLogging: { ignore: (req) => req.url === "/api/health" },
    serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: stripQuery(req.url), ip: req.remoteAddress }),
        res: (res) => ({ statusCode: res.statusCode }),
    },
});

module.exports = { logger, httpLogger, REDACT_PATHS };
