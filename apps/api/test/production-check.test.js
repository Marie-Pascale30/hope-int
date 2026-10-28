const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { checkProductionConfig } = require("../config/productionCheck");

const VALID = {
    JWT_SECRET: "x".repeat(48),
    ENGAGEMENT_TOKEN_SECRET: "y".repeat(48),
    FRONTEND_URL: "https://hopeintapp.com",
    API_PUBLIC_URL: "https://api.hopeintapp.com/api",
    CORS_ORIGIN: "https://hopeintapp.com,https://www.hopeintapp.com",
    DB_PASSWORD: "secret",
    SMTP_HOST: "smtp.example.org",
    SMTP_PORT: "587",
    SMTP_USER: "hope",
    SMTP_PASS: "pass",
    STRIPE_SECRET_KEY: "sk_live_abc",
    STRIPE_WEBHOOK_SECRET: "whsec_abc",
    NOTCHPAY_PRIVATE_KEY: "np",
    SENTRY_DSN: "https://sentry.example.org/1",
    TRUST_PROXY: "1",
};

describe("configuration de production", () => {
    it("accepte une configuration complete sans avertissement", () => {
        assert.deepEqual(checkProductionConfig(VALID), { errors: [], warnings: [] });
    });

    it("refuse un secret court, une URL en http, des cookies non securises et l'absence de SMTP", () => {
        const { errors } = checkProductionConfig({
            ...VALID,
            JWT_SECRET: "court",
            FRONTEND_URL: "http://hopeintapp.com",
            COOKIE_SECURE: "false",
            SMTP_HOST: "",
        });
        assert.equal(errors.length, 4);
    });

    it("signale les cles de paiement de test sans bloquer", () => {
        const { errors, warnings } = checkProductionConfig({ ...VALID, STRIPE_SECRET_KEY: "sk_test_abc" });
        assert.equal(errors.length, 0);
        assert.ok(warnings.some((warning) => warning.includes("TEST")));
    });
});
