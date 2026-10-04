const { db, request, app, resetDatabase, client } = require("./helpers");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

// Les prestataires ne sont pas configures pendant les tests (voir helpers.js) :
// on verifie les validations et les refus, sans aucun appel externe.
describe("dons et webhooks", () => {
    before(() => resetDatabase());
    after(() => db.end());

    const donate = (body) => client().post("/api/payment/donations", body);

    it("refuse un montant sous le minimum", async () => {
        const res = await donate({ amount: 0.5, provider: "stripe", donorName: "Ada", donorEmail: "ada@test.hope.org" });
        assert.equal(res.status, 400);
    });

    it("refuse un montant au-dessus du maximum", async () => {
        const res = await donate({ amount: 100001, provider: "stripe", donorName: "Ada", donorEmail: "ada@test.hope.org" });
        assert.equal(res.status, 400);
    });

    it("refuse un prestataire inconnu", async () => {
        const res = await donate({ amount: 10, provider: "paypal" });
        assert.equal(res.status, 422);
    });

    it("refuse le don mensuel hors carte bancaire", async () => {
        const res = await donate({ amount: 5000, provider: "mobile_money", frequency: "monthly", donorName: "Ada", donorEmail: "ada@test.hope.org" });
        assert.equal(res.status, 400);
    });

    it("signale un moyen de paiement non configure (503) sans creer de don", async () => {
        const res = await donate({ amount: 10, provider: "stripe", donorName: "Ada", donorEmail: "ada@test.hope.org" });

        assert.equal(res.status, 503);
        const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM payments");
        assert.equal(total, 0);
    });

    it("rejette un webhook Stripe sans signature", async () => {
        const res = await request(app)
            .post("/api/payment/webhook")
            .set("Content-Type", "application/json")
            .send(JSON.stringify({ type: "payment_intent.succeeded" }));
        assert.equal(res.status, 400);
    });

    it("rejette un webhook Notch Pay non signe", async () => {
        const res = await request(app)
            .post("/api/payment/notchpay/webhook")
            .set("Content-Type", "application/json")
            .send(JSON.stringify({ event: "payment.complete" }));
        assert.ok([400, 401].includes(res.status));
    });

    it("rejette un webhook Flutterwave non signe", async () => {
        const res = await request(app).post("/api/payment/flutterwave/webhook").send({ event: "charge.completed" });
        assert.ok([400, 401].includes(res.status));
    });

    it("refuse un jeton de recu mal forme", async () => {
        assert.equal((await request(app).get("/api/payment/receipts/pas-un-jeton")).status, 422);
    });

    it("renvoie 404 pour un recu inconnu", async () => {
        const token = "a".repeat(48);
        assert.equal((await request(app).get(`/api/payment/receipts/${token}`)).status, 404);
    });
});
