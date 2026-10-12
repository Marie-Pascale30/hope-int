// Garde-fous communs aux scripts de donnees de demonstration (seed.js, seed-demo.js).
// A appeler AVANT de charger config/db (aucune connexion ouverte si le script est refuse).

/** Refuse l'execution en production, sauf --force explicite. */
function refuseInProduction(scriptName, argv = process.argv) {
    if (process.env.NODE_ENV !== "production") return;
    if (argv.includes("--force")) {
        console.warn(`ATTENTION : ${scriptName} execute en production (--force).`);
        return;
    }
    console.error(
        `${scriptName} refuse de s'executer avec NODE_ENV=production : il ecrit des donnees de demonstration ` +
            "(comptes aux mots de passe publics). Ajouter --force uniquement si c'est vraiment voulu."
    );
    process.exit(1);
}

/**
 * Avertit avant de vider des tables, puis laisse quelques secondes pour annuler (Ctrl+C).
 * --yes supprime l'attente (scripts, CI).
 */
async function warnBeforeTruncate(tables, { argv = process.argv, delayMs = 5000 } = {}) {
    const database = process.env.DB_NAME || "hope_platform";
    const host = process.env.DB_HOST || "localhost";
    console.warn(
        `\nATTENTION : les tables suivantes de la base "${database}" (${host}) vont etre VIDEES :\n  ${tables.join(", ")}\n`
    );
    if (argv.includes("--yes")) return;
    console.warn(`Ctrl+C pour annuler. Reprise dans ${Math.round(delayMs / 1000)} s (--yes pour ne pas attendre)...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
}

module.exports = { refuseInProduction, warnBeforeTruncate };
