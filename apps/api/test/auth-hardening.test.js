const { db, request, app, resetDatabase, createUser, client, loginAs, PASSWORD } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { sha256 } = require("../utils/security");
const resetRepo = require("../repositories/passwordResetRepository");

const consoleOutput = (log) => log.mock.calls.map((call) => call.arguments.join(" ")).join("\n");

describe("authentification : inscription neutre, sessions et limitations par compte", () => {
    before(() => resetDatabase());
    after(() => db.end());

    describe("POST /auth/register", () => {
        it("cree un compte invite et repond 201 avec un message", async () => {
            const res = await client().post("/api/auth/register", { name: "Nouvelle Membre", email: "Nouvelle@Test.hope.org", password: "Secret@1234" });

            assert.equal(res.status, 201);
            assert.equal(typeof res.body.message, "string");
            const [[user]] = await db.query("SELECT roles, status FROM users WHERE email = 'nouvelle@test.hope.org'");
            assert.deepEqual(JSON.parse(user.roles), ["invite"]);
            assert.equal(user.status, "active");
            assert.equal((await loginAs({ email: "nouvelle@test.hope.org", password: "Secret@1234" })).agent ? 1 : 0, 1);
        });

        it("repond a l'identique pour un email deja inscrit et previent son titulaire", async (t) => {
            const existing = await createUser({ name: "Titulaire" });
            const [[before]] = await db.query("SELECT password FROM users WHERE id = ?", [existing.id]);
            const log = t.mock.method(console, "log", () => {});

            const fresh = await client().post("/api/auth/register", { name: "Autre", email: "libre@test.hope.org", password: "Secret@1234" });
            const taken = await client().post("/api/auth/register", { name: "Intrus", email: existing.email, password: "Pirate@1234" });

            assert.equal(taken.status, fresh.status);
            assert.deepEqual(taken.body, fresh.body, "aucune difference observable");
            const [[after]] = await db.query("SELECT name, password FROM users WHERE id = ?", [existing.id]);
            assert.equal(after.password, before.password, "le compte existant n'est pas modifie");
            assert.equal(after.name, "Titulaire");
            assert.ok(await bcrypt.compare(PASSWORD, after.password));
            assert.match(consoleOutput(log), /Quelqu'un a tenté de créer un compte/);
            const [[audit]] = await db.query("SELECT user_id FROM activity_logs WHERE action = 'auth.register_existing' ORDER BY id DESC LIMIT 1");
            assert.equal(audit.user_id, existing.id);
        });

        it("refuse un mot de passe faible ou une saisie invalide", async () => {
            assert.equal((await client().post("/api/auth/register", { name: "X", email: "faible@test.hope.org", password: "Secret@1234" })).status, 422);
            assert.equal((await client().post("/api/auth/register", { name: "Faible", email: "faible@test.hope.org", password: "motdepasse" })).status, 400);
        });
    });

    describe("POST /auth/logout-all", () => {
        it("ferme toutes les sessions du compte et efface le cookie", async () => {
            const user = await createUser();
            const other = await loginAs(user);
            const current = await loginAs(user);

            const res = await current.post("/api/auth/logout-all");
            assert.equal(res.status, 200);
            assert.ok(res.headers["set-cookie"].some((value) => /^hope_session=;/.test(value)));
            assert.equal((await current.get("/api/auth/me")).status, 401);
            assert.equal((await other.get("/api/auth/me")).status, 401);
            assert.equal((await loginAs(user)).agent ? 1 : 0, 1, "une nouvelle connexion reste possible");
        });

        it("exige une session", async () => {
            assert.equal((await request(app).post("/api/auth/logout-all")).status, 401);
        });
    });

    describe("limitation par compte", () => {
        it("bloque la connexion apres 10 echecs sur le meme email, meme avec le bon mot de passe", async () => {
            const user = await createUser();
            for (let i = 0; i < 10; i += 1) {
                assert.equal((await client().post("/api/auth/login", { email: user.email, password: "Mauvais@123" })).status, 401);
            }
            const blocked = await client().post("/api/auth/login", { email: user.email, password: PASSWORD });
            assert.equal(blocked.status, 429);
            assert.equal(blocked.body.code, "ACCOUNT_THROTTLED");

            // Les autres comptes ne sont pas concernes.
            assert.equal((await client().post("/api/auth/login", { email: (await createUser()).email, password: PASSWORD })).status, 200);
        });

        it("remet le compteur a zero apres une connexion reussie", async () => {
            const user = await createUser();
            for (let i = 0; i < 9; i += 1) await client().post("/api/auth/login", { email: user.email, password: "Mauvais@123" });
            assert.equal((await client().post("/api/auth/login", { email: user.email, password: PASSWORD })).status, 200);
            const [[row]] = await db.query("SELECT COUNT(*) AS total FROM auth_attempts WHERE scope = 'login' AND identifier = ?", [user.email]);
            assert.equal(row.total, 0);
        });

        it("n'envoie plus d'email de reinitialisation au-dela de 5 demandes, sans changer la reponse", async (t) => {
            const user = await createUser();
            const log = t.mock.method(console, "log", () => {});
            const responses = [];
            for (let i = 0; i < 7; i += 1) {
                responses.push(await client().post("/api/auth/forgot-password", { email: user.email }));
            }
            assert.ok(responses.every((res) => res.status === 200 && res.body.message === responses[0].body.message));
            const sent = (consoleOutput(log).match(/reinitialiser-mot-de-passe\?token=/g) || []).length;
            assert.equal(sent, 5);
        });
    });

    describe("reinitialisation du mot de passe", () => {
        async function resetLink(user) {
            const token = "b".repeat(32) + String(user.id).padStart(32, "0");
            await resetRepo.create(user.id, sha256(token), 60);
            return token;
        }

        it("n'accepte qu'une seule utilisation simultanee du lien", async () => {
            const user = await createUser();
            const token = await resetLink(user);
            const results = await Promise.all([
                client().post("/api/auth/reset-password", { token, password: "Premier@1234" }),
                client().post("/api/auth/reset-password", { token, password: "Second@1234" }),
                client().post("/api/auth/reset-password", { token, password: "Troisieme@1234" }),
            ]);
            const statuses = results.map((res) => res.status).sort();
            assert.deepEqual(statuses, [200, 400, 400]);
            assert.ok(results.filter((res) => res.status === 400).every((res) => res.body.code === "RESET_LINK_INVALID"));

            const winner = ["Premier@1234", "Second@1234", "Troisieme@1234"][results.findIndex((res) => res.status === 200)];
            const [[row]] = await db.query("SELECT password FROM users WHERE id = ?", [user.id]);
            assert.ok(await bcrypt.compare(winner, row.password), "le mot de passe retenu est celui de la requete acceptee");
        });

        it("ne consomme pas le lien si le nouveau mot de passe est refuse", async () => {
            const user = await createUser();
            const token = await resetLink(user);
            assert.equal((await client().post("/api/auth/reset-password", { token, password: "sanschiffre" })).status, 400);
            assert.equal((await client().post("/api/auth/reset-password", { token, password: "Valide@1234" })).status, 200);
        });
    });
});
