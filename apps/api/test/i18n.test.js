const { db, request, app, resetDatabase, createUser } = require("./helpers");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { translate } = require("../i18n");
const { MESSAGES } = require("../i18n/messages");

describe("traduction des messages de l'API", () => {
    before(() => resetDatabase());
    after(() => db.end());

    it("traduit un message connu et laisse les autres en francais", () => {
        assert.equal(translate("Don introuvable", "en"), "Donation not found");
        assert.equal(translate("Don introuvable", "es"), "Donación no encontrada");
        assert.equal(translate("Don introuvable", "fr"), "Don introuvable");
        assert.equal(translate("Message inconnu du catalogue", "en"), "Message inconnu du catalogue");
    });

    it("traduit les messages a valeurs variables", () => {
        assert.equal(
            translate("Le montant doit être compris entre 1 et 100000 EUR", "en"),
            "The amount must be between 1 and 100000 EUR"
        );
        assert.equal(translate("Aucun don confirmé en 2025", "es"), "Ninguna donación confirmada en 2025");
    });

    it("repond dans la langue demandee par Accept-Language", async () => {
        const user = await createUser();
        const login = (language) => request(app)
            .post("/api/auth/login")
            .set("Accept-Language", language)
            .send({ email: user.email, password: "Mauvais@123" });

        assert.equal((await login("en-US,en;q=0.9")).body.error, "Incorrect email or password");
        assert.equal((await login("es")).body.error, "Correo electrónico o contraseña incorrectos");
        assert.equal((await login("fr-FR")).body.error, "Email ou mot de passe incorrect");
        assert.equal((await login("de")).body.error, "Email ou mot de passe incorrect", "langue non geree : francais");
    });

    it("traduit aussi les erreurs de validation et les routes inconnues", async () => {
        const notFound = await request(app).get("/api/inconnue").set("Accept-Language", "en");
        assert.equal(notFound.body.error, "Route not found");
        assert.match(notFound.headers.vary, /Accept-Language/);
    });

    it("ne contient que des messages encore presents dans le code", () => {
        const root = path.join(__dirname, "..");
        const sources = [];
        (function walk(dir) {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (["node_modules", "test", "migrations", "i18n"].includes(entry.name)) continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.name.endsWith(".js")) sources.push(fs.readFileSync(full, "utf8"));
            }
        })(root);
        const code = sources.join("\n");
        const orphans = Object.keys(MESSAGES).filter((message) => !code.includes(message));
        assert.deepEqual(orphans, [], "messages du catalogue introuvables dans le code (texte modifie ?)");
    });
});
