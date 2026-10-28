require("dotenv").config();

// Import du contenu reel (projets, actualites, temoignages) dans une base de production.
// Contrairement a seed.js, aucune donnee de demonstration : ni compte, ni don, ni evenement fictif.
// Rejouable : seuls les elements absents (reperes par leur titre) sont ajoutes.
// Usage : npm run content:import             -> ajoute ce qui manque
//         npm run content:import -- --update -> remet aussi a jour le texte des actualites existantes
//                                               (ecrase les modifications faites dans l'administration)
// A lancer apres les migrations (npm run migrate).
const db = require("../config/db");
const { importProjects, importNews, importTestimonials } = require("./content");

const UPDATE = process.argv.includes("--update");

async function main() {
    try {
        const projects = await importProjects(db);
        const news = await importNews(db, projects.ids, { update: UPDATE });
        const testimonials = await importTestimonials(db, projects.ids);
        console.log(
            `Contenu importé : ${projects.created} projet(s), ${news.created} actualité(s)` +
                `${UPDATE ? ` (${news.updated} mise(s) à jour)` : ""}, ${testimonials.created} témoignage(s).`
        );
    } catch (error) {
        console.error("Erreur import du contenu :", error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

main();
