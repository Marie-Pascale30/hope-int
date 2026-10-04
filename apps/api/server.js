require("dotenv").config();

const app = require("./app");
const db = require("./config/db");
const { runMigrations } = require("./config/migrate");
const emailOutbox = require("./services/emailOutbox");

// Migrations appliquees au demarrage (desactivable avec MIGRATE_ON_START=false, par exemple
// si elles sont lancees a part avec `npm run migrate` lors du deploiement).
const migrateOnStart = process.env.MIGRATE_ON_START !== "false";

const PORT = Number(process.env.PORT) || 5000;
// Hors production, un port occupe bascule sur le suivant libre (PORT_FALLBACK=false pour l'interdire).
// En production, le port est impose (Docker, reverse proxy) : un conflit reste une erreur.
const allowPortFallback = process.env.NODE_ENV !== "production" && process.env.PORT_FALLBACK !== "false";
const MAX_PORT_ATTEMPTS = 20;

let server;

function listen(port, attempt = 0) {
  const instance = app.listen(port);
  instance.once("listening", () => {
    server = instance;
    if (attempt === 0) {
      console.log(`Serveur lancé sur http://localhost:${port}`);
      return;
    }
    console.log(`Serveur lancé sur http://localhost:${port} (port ${PORT} occupé)`);
    console.log("Le site doit viser ce port (NEXT_PUBLIC_API_BASE_URL) ; `npm run dev` à la racine le fait automatiquement.");
  });
  instance.once("error", (err) => {
    if (err.code === "EADDRINUSE" && allowPortFallback && attempt < MAX_PORT_ATTEMPTS) {
      listen(port + 1, attempt + 1);
      return;
    }
    console.error(err.code === "EADDRINUSE" ? `Port ${port} déjà utilisé.` : `Erreur serveur : ${err.message}`);
    process.exit(1);
  });
}

(migrateOnStart ? runMigrations() : Promise.resolve())
  .then(() => {
    listen(PORT);
    // File d'envoi des emails (ignoree avec NODE_ENV=test ou EMAIL_OUTBOX_WORKER=false).
    emailOutbox.start();
  })
  .catch((err) => {
    console.error("Erreur initialisation DB:", err.message);
    process.exit(1);
  });

function shutdown(signal) {
  console.log(`${signal} reçu, arrêt du serveur...`);
  if (!server) {
    process.exit(0);
  }

  server.close(async () => {
    try {
      await emailOutbox.stop();
    } catch (err) {
      console.error("Erreur arrêt file d'emails:", err.message);
    }
    try {
      await db.end();
    } catch (err) {
      console.error("Erreur fermeture pool MySQL:", err.message);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
