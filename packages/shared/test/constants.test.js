const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { toEur, XAF_PER_EUR, DONATION_LIMITS, CURRENCIES } = require("../src/constants");

describe("constants", () => {
    it("convertit le franc CFA en euros a parite fixe", () => {
        assert.equal(toEur(XAF_PER_EUR, "xaf"), 1);
        assert.equal(toEur(655957, "XAF"), 1000);
        assert.equal(toEur(12.5, "eur"), 12.5);
        assert.equal(toEur("abc", "eur"), 0);
    });

    it("definit des limites de don pour chaque devise", () => {
        for (const currency of CURRENCIES) {
            const { min, max } = DONATION_LIMITS[currency];
            assert.ok(min > 0 && max > min, currency);
        }
    });
});
