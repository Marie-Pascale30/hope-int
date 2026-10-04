// Lanceur de developpement : choisit des ports libres pour l'API et le site, puis demarre
// chaque application avec les adresses de l'autre (URL de l'API pour le site ; origine CORS
// et liens de retour pour l'API).
//
//   node scripts/dev.js        API + site (npm run dev)
//   node scripts/dev.js web    site seul, qui vise l'API sur API_PORT (defaut 5000)
//
// Ports souhaites : API_PORT (defaut : PORT de apps/api/.env, sinon 5000) et WEB_PORT (defaut 3001).
// Si un port est occupe, le suivant libre est utilise.
const fs = require("fs");
const net = require("net");
const path = require("path");
const concurrently = require("concurrently");

const ROOT = path.join(__dirname, "..");
const MAX_ATTEMPTS = 50;

// PORT declare dans apps/api/.env (sans charger tout le fichier dans ce processus).
function apiPortFromEnvFile() {
    try {
        const content = fs.readFileSync(path.join(ROOT, "apps", "api", ".env"), "utf8");
        const match = content.match(/^PORT\s*=\s*(\d+)\s*$/m);
        return match ? Number(match[1]) : null;
    } catch {
        return null;
    }
}

// Un port est libre s'il peut etre ouvert en IPv6 (toutes interfaces) et en IPv4 local :
// un service ecoutant seulement sur 127.0.0.1 doit aussi etre detecte.
function canListen(port, host) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.unref();
        server.once("error", (error) => resolve(error.code === "EADDRNOTAVAIL" || error.code === "EAFNOSUPPORT"));
        server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
    });
}

async function isFree(port) {
    return (await canListen(port, "::")) && (await canListen(port, "127.0.0.1"));
}

async function findFreePort(preferred, taken = []) {
    for (let port = preferred; port < preferred + MAX_ATTEMPTS; port += 1) {
        if (!taken.includes(port) && (await isFree(port))) return port;
    }
    throw new Error(`Aucun port libre entre ${preferred} et ${preferred + MAX_ATTEMPTS - 1}`);
}

// Next n'autorise qu'un serveur de developpement par dossier : son verrou indique celui qui tourne.
function runningWebServer() {
    try {
        const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "apps", "web", ".next", "dev", "lock"), "utf8"));
        process.kill(lock.pid, 0); // leve une erreur si le processus n'existe plus (verrou perime)
        return lock;
    } catch {
        return null;
    }
}

function describe(name, preferred, actual, suffix = "") {
    const url = `${name} : http://localhost:${actual}${suffix}`;
    return actual === preferred ? url : `${url}  (port ${preferred} occupé)`;
}

async function main() {
    const mode = process.argv[2] || "all";

    // Le site HOPE tourne deja : un second serveur serait refuse par Next, autant le dire.
    const existing = runningWebServer();
    if (existing) {
        console.log(`\nLe site HOPE tourne déjà sur ${existing.appUrl} (PID ${existing.pid}).`);
        console.log("Utilisez-le, ou arrêtez-le avant de relancer `npm run dev`.\n");
        return;
    }

    const wantedApi = Number(process.env.API_PORT) || apiPortFromEnvFile() || 5000;
    const wantedWeb = Number(process.env.WEB_PORT) || 3001;

    // Site seul : l'API est supposee deja lancee sur le port souhaite.
    const apiPort = mode === "web" ? wantedApi : await findFreePort(wantedApi);
    const webPort = await findFreePort(wantedWeb, [apiPort]);

    const apiUrl = `http://localhost:${apiPort}/api`;
    const webUrl = `http://localhost:${webPort}`;

    const commands = [];
    if (mode !== "web") {
        commands.push({
            name: "api",
            prefixColor: "magenta",
            command: "npm run dev -w @hope/api",
            // Les variables du processus priment sur apps/api/.env (dotenv ne les ecrase pas).
            env: { PORT: String(apiPort), CORS_ORIGIN: webUrl, FRONTEND_URL: webUrl, API_PUBLIC_URL: apiUrl },
        });
    }
    commands.push({
        name: "web",
        prefixColor: "cyan",
        command: `npm exec -w @hope/web -- next dev -p ${webPort}`,
        // Les variables du processus priment aussi sur les fichiers .env de Next.
        env: { NEXT_PUBLIC_API_BASE_URL: apiUrl, API_INTERNAL_URL: apiUrl, NEXT_PUBLIC_SITE_URL: webUrl },
    });

    console.log("\nHOPE International - développement");
    if (mode !== "web") console.log(`  ${describe("API ", wantedApi, apiPort, "/api")}`);
    else console.log(`  API  : ${apiUrl}  (doit déjà être lancée)`);
    console.log(`  ${describe("Site", wantedWeb, webPort)}\n`);

    const { result } = concurrently(commands, { cwd: ROOT, killOthersOn: ["failure"], prefix: "name" });
    await result.catch(() => {
        process.exitCode = 1;
    });
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
