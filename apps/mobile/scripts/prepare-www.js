// Prepare www/ (pages locales embarquees dans l'application) avant "cap sync" :
// - offline.html : page hors connexion du site, dont le bouton Reessayer recharge le site en ligne ;
// - index.html : point d'entree exige par Capacitor (redirige vers le site).
const fs = require("fs");
const path = require("path");
const config = require("../capacitor.config");

const ROOT = path.join(__dirname, "..");
const WEB_PUBLIC = path.join(ROOT, "..", "web", "public");
const WWW = path.join(ROOT, "www");
const APP_URL = config.server.url;

fs.mkdirSync(path.join(WWW, "icons"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "..", "web", "app", "icon.svg"), path.join(WWW, "icon.svg"));
fs.copyFileSync(path.join(WEB_PUBLIC, "icons", "icon-192.png"), path.join(WWW, "icons", "icon-192.png"));

const offline = fs.readFileSync(path.join(WEB_PUBLIC, "offline.html"), "utf8");
const retry = 'function () { location.reload(); }';
if (!offline.includes(retry)) throw new Error("offline.html : bouton Reessayer introuvable");
const appOffline = offline
  .split(retry)
  .join(`function () { location.href = ${JSON.stringify(APP_URL)}; }`)
  // La langue suit le telephone (pas de prefixe d'URL dans la page locale).
  .replace('var match = location.pathname.match(/^\/(en|es)(\/|$)/);', "var match = null;");
fs.writeFileSync(path.join(WWW, "offline.html"), appOffline);

fs.writeFileSync(
  path.join(WWW, "index.html"),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>Hope International</title><meta http-equiv="refresh" content="0; url=${APP_URL}"></head>` +
    `<body style="margin:0;background:#1f5f4a"></body></html>\n`,
);
console.log(`www/ pret (site : ${APP_URL})`);
