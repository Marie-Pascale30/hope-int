// Application Express, sans demarrage du serveur : importable telle quelle par les tests.
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const db = require("./config/db");
const paymentController = require("./controllers/paymentController");
const { csrfGuard } = require("./config/session");
const { localizeResponses } = require("./i18n");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error("JWT_SECRET doit contenir au moins 32 caractères en production.");
  process.exit(1);
}

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const rateLimitMax = Number(process.env.API_RATE_LIMIT_MAX || (isProduction ? 500 : 5000));
const bypassLocalRateLimit = process.env.BYPASS_LOCAL_RATE_LIMIT !== "false";
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, veuillez réessayer dans quelques instants." },
  skip: (req) => {
    if (isProduction || !bypassLocalRateLimit) return false;
    return req.ip === "::1" || req.ip === "127.0.0.1" || req.ip === "::ffff:127.0.0.1";
  },
});

if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// Middleware
// Images uploadees affichees par le frontend (autre origine) : ressource cross-origin autorisee.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
// credentials : le navigateur envoie le cookie de session aux origines autorisees.
app.use(cors({ origin: corsOrigins, credentials: true }));
if (process.env.NODE_ENV !== "test") app.use(morgan(isProduction ? "combined" : "dev"));
// Messages traduits selon Accept-Language (avant le limiteur pour traduire aussi ses refus).
app.use(localizeResponses);
app.use(apiLimiter);

// Le webhook Stripe exige le corps brut pour verifier la signature.
app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleStripeWebhook
);

// Notch Pay signe lui aussi le corps brut (HMAC-SHA256).
app.post(
  "/api/payment/notchpay/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleNotchpayWebhook
);

app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use(csrfGuard);
app.use("/uploads", express.static("uploads", { maxAge: "7d" }));

app.get("/", (_req, res) => {
  res.send("HOPE INTERNATIONAL BACKEND RUNNING");
});

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (_error) {
    res.status(503).json({ status: "degraded" });
  }
});

// Routes principales
app.use("/api/auth", require("./routes/authRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));
app.use("/api/admin", require("./routes/adminRoute"));
app.use("/api", require("./routes/publicRoute"));

// 404 pour toute route non definie
app.use((_req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

// Handler d'erreur centralise (doit rester le dernier middleware)
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image trop lourde (5 Mo maximum)" : "Fichier refusé";
    return res.status(400).json({ error: message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Requête JSON invalide" });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);

  // Les erreurs metier (4xx) sont destinees a l'utilisateur ; les erreurs serveur restent generiques en production.
  res.status(status).json({
    error: status < 500 || !isProduction ? err.message : "Erreur serveur",
    ...(err.code && status < 500 ? { code: err.code } : {}),
    ...(err.details && status < 500 ? { details: err.details } : {}),
  });
});

module.exports = app;
