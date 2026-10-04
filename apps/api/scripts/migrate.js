require("dotenv").config();

const db = require("../config/db");
const { runMigrations, status } = require("../config/migrate");

// npm run migrate            applique les migrations en attente
// npm run migrate -- --status  liste les migrations et leur etat
async function main() {
    if (process.argv.includes("--status")) {
        for (const { name, applied } of await status()) {
            console.log(`${applied ? "[x]" : "[ ]"} ${name}`);
        }
        return;
    }

    const applied = await runMigrations();
    console.log(applied.length ? `${applied.length} migration(s) appliquée(s).` : "Schéma à jour.");
}

main()
    .catch((error) => {
        console.error("Erreur de migration :", error.message);
        process.exitCode = 1;
    })
    .finally(() => db.end());
