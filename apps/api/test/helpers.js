// A importer en premier dans chaque fichier de test : configure l'environnement avant que
// l'application (et le pool MySQL) ne soient charges.
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.TEST_DB_NAME || "hope_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-0000";
// Aucun appel reel aux prestataires de paiement ni envoi d'email pendant les tests.
for (const key of [
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "NOTCHPAY_PUBLIC_KEY", "NOTCHPAY_PRIVATE_KEY", "NOTCHPAY_WEBHOOK_HASH",
    "FLUTTERWAVE_SECRET_KEY", "FLUTTERWAVE_WEBHOOK_HASH", "MOBILE_MONEY_PROVIDER",
    "SMTP_HOST", "SMTP_USER", "SMTP_PASS",
]) {
    process.env[key] = "";
}

// Garde-fou : les tests vident la base, jamais ailleurs que sur une base *_test.
if (!/_test$/.test(process.env.DB_NAME)) {
    throw new Error(`Base de test invalide : ${process.env.DB_NAME} (le nom doit finir par _test)`);
}

const bcrypt = require("bcryptjs");
const request = require("supertest");
const app = require("../app");
const db = require("../config/db");
const { runMigrations } = require("../config/migrate");
const userRepo = require("../repositories/userRepository");

const PASSWORD = "Test@123456";

// Base vide puis schema complet : chaque fichier de test part d'un etat connu.
async function resetDatabase() {
    const [tables] = await db.query(
        "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
    );
    const connection = await db.getConnection();
    try {
        await connection.query("SET FOREIGN_KEY_CHECKS = 0");
        for (const { name } of tables) await connection.query(`DROP TABLE \`${name}\``);
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } finally {
        connection.release();
    }
    await runMigrations({ log: () => {} });
}

let counter = 0;
async function createUser({ roles = ["membre"], mustChangePassword = false, password = PASSWORD, ...rest } = {}) {
    counter += 1;
    const email = rest.email || `user${counter}-${roles.join("-")}@test.hope.org`;
    const id = await userRepo.create({
        name: rest.name || `Test ${roles.join(" ")}`,
        email,
        password: await bcrypt.hash(password, 4),
        roles,
        region: rest.region,
        mustChangePassword,
    });
    return { id, email, password, roles };
}

// Client HTTP qui conserve le cookie de session, comme le navigateur.
function client() {
    const agent = request.agent(app);
    const withHeaders = (req) => req.set("X-Requested-With", "XMLHttpRequest");
    return {
        agent,
        get: (url) => agent.get(url),
        post: (url, body) => withHeaders(agent.post(url)).send(body),
        patch: (url, body) => withHeaders(agent.patch(url)).send(body),
        delete: (url) => withHeaders(agent.delete(url)),
    };
}

async function loginAs(user) {
    const http = client();
    const res = await http.post("/api/auth/login", { email: user.email, password: user.password });
    if (res.status !== 200) throw new Error(`Connexion impossible pour ${user.email} : ${res.status}`);
    return http;
}

// Don insere directement en base (sans prestataire), pour les tests de paiement.
async function createPayment(overrides = {}) {
    counter += 1;
    const data = {
        user_id: null,
        amount: 10,
        currency: "eur",
        method: "card",
        provider: "stripe",
        status: "pending",
        transaction_id: `pi_test_${counter}_${Date.now()}`,
        donor_name: "Ada Donatrice",
        donor_email: "ada@test.hope.org",
        project_id: null,
        frequency: "once",
        subscription_id: null,
        receipt_token: require("crypto").randomBytes(24).toString("hex"),
        ...overrides,
    };
    const columns = Object.keys(data);
    const [result] = await db.query(
        `INSERT INTO payments (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
        columns.map((column) => data[column])
    );
    return { id: result.insertId, ...data };
}

// Remplace temporairement des methodes d'un module (prestataires) ; renvoie la fonction de restauration.
function mockMethods(target, methods) {
    const originals = {};
    for (const [name, impl] of Object.entries(methods)) {
        originals[name] = target[name];
        target[name] = impl;
    }
    return () => Object.assign(target, originals);
}

module.exports = { app, db, request, resetDatabase, createUser, createPayment, mockMethods, client, loginAs, PASSWORD };
