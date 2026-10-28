require("dotenv").config();

// Creation du premier compte administrateur (base de production vide : seed.js y est refuse).
// Le mot de passe provisoire est affiche une seule fois ; il doit etre change a la premiere connexion.
// Usage : npm run admin:create -- --email presidente@hopeintapp.com --name "Prenom Nom"
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const userRepo = require("../repositories/userRepository");
const { generateTempPassword } = require("../utils/security");

function option(name) {
    const index = process.argv.indexOf(`--${name}`);
    return index > -1 ? String(process.argv[index + 1] || "").trim() : "";
}

async function main() {
    const email = option("email").toLowerCase();
    const name = option("name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2) {
        console.error('Usage : npm run admin:create -- --email adresse@exemple.org --name "Prénom Nom"');
        process.exitCode = 1;
        return;
    }
    try {
        if (await userRepo.findByEmail(email)) {
            console.error(`Un compte existe déjà pour ${email} : rien n'a été modifié.`);
            process.exitCode = 1;
            return;
        }
        const password = generateTempPassword();
        await userRepo.create({
            name,
            email,
            password: await bcrypt.hash(password, 12),
            roles: ["admin"],
            mustChangePassword: true,
        });
        console.log(`Administrateur créé : ${email}`);
        console.log(`Mot de passe provisoire (affiché une seule fois) : ${password}`);
        console.log("Il devra être changé à la première connexion.");
    } catch (error) {
        console.error("Erreur création de l'administrateur :", error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

main();
