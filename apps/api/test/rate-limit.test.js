// Limiteur global volontairement bas pour ce fichier (variables lues au chargement de l'app).
process.env.API_RATE_LIMIT_MAX = "3";
process.env.BYPASS_LOCAL_RATE_LIMIT = "false";

const { db, request, app } = require("./helpers");
const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");

describe("limiteur global et webhooks", () => {
    after(() => db.end());

    it("limite les routes de l'API mais jamais les webhooks des prestataires", async () => {
        for (let i = 0; i < 3; i += 1) {
            assert.equal((await request(app).get("/api/meta")).status, 200);
        }
        assert.equal((await request(app).get("/api/meta")).status, 429, "limite atteinte");

        // Signature absente : refus du webhook lui-meme (4xx), jamais 429.
        for (let i = 0; i < 5; i += 1) {
            const stripe = await request(app).post("/api/payment/webhook").set("Content-Type", "application/json").send("{}");
            const notchpay = await request(app).post("/api/payment/notchpay/webhook").set("Content-Type", "application/json").send("{}");
            const flutterwave = await request(app).post("/api/payment/flutterwave/webhook").send({ data: {} });
            for (const res of [stripe, notchpay, flutterwave]) {
                assert.notEqual(res.status, 429);
                assert.ok(res.status >= 400 && res.status < 500);
            }
        }
        assert.deepEqual([...app.WEBHOOK_PATHS].sort(), [
            "/api/payment/flutterwave/webhook", "/api/payment/notchpay/webhook", "/api/payment/webhook",
        ]);
    });
});
