// Lance l'application sur un emulateur ou un telephone Android branche, avec le site local.
//   npm run android:dev                (site sur le port 3001, API sur le port 5000)
//   WEB_PORT=3002 API_PORT=5001 npm run android:dev
// "adb reverse" fait pointer localhost du telephone vers ce PC : memes adresses que dans le navigateur
// (cookies de session et CORS inchanges).
const { execFileSync } = require("child_process");
const path = require("path");
const { androidEnv, adb } = require("./env");

const WEB_PORT = process.env.WEB_PORT || "3001";
const API_PORT = process.env.API_PORT || "5000";
const env = androidEnv({ HOPE_APP_URL: `http://localhost:${WEB_PORT}` });
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", env, cwd: path.join(__dirname, ".."), shell: process.platform === "win32" && !path.isAbsolute(cmd), ...opts });

run("node", ["scripts/prepare-www.js"]);
run("npx", ["cap", "sync", "android"]);
for (const port of [WEB_PORT, API_PORT]) run(adb(env), ["reverse", `tcp:${port}`, `tcp:${port}`]);
run("npx", ["cap", "run", "android", ...process.argv.slice(2)]);
