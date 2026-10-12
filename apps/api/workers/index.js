const fs = require("fs");
const path = require("path");

// Taches planifiees des modules fonctionnels : chaque fichier de ce dossier exporte
// { name, start(), stop() } ; start ne doit rien faire avec NODE_ENV=test et doit respecter
// sa propre variable de desactivation (ex. PLEDGE_REMINDER_WORKER=false).
function loadWorkers() {
    return fs
        .readdirSync(__dirname)
        .filter((file) => file.endsWith(".js") && file !== "index.js")
        .sort()
        .map((file) => require(path.join(__dirname, file)));
}

let workers = [];

exports.startAll = () => {
    workers = loadWorkers();
    workers.forEach((worker) => worker.start());
};

exports.stopAll = async () => {
    for (const worker of workers) {
        try {
            await worker.stop();
        } catch (error) {
            console.error(`Erreur arret de la tache ${worker.name}:`, error.message);
        }
    }
};
