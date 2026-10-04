const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { INTEREST_AREAS, INTEREST_VALUES, normalizeInterests, getInterestLabel } = require("../src/applications");
const shared = require("../src");

describe("poles d'interet des candidatures", () => {
    it("propose des valeurs uniques, toutes libellees", () => {
        assert.equal(new Set(INTEREST_VALUES).size, INTEREST_AREAS.length);
        for (const area of INTEREST_AREAS) {
            assert.match(area.value, /^[a-z_]+$/);
            assert.ok(area.label.length > 2);
        }
        assert.ok(INTEREST_VALUES.includes("autre"));
    });

    it("ne contient aucun role de la plateforme", () => {
        for (const value of INTEREST_VALUES) assert.equal(shared.ORG_ROLES.includes(value), false, value);
    });

    it("normalise : valeurs connues, sans doublon, ordre du referentiel", () => {
        assert.deepEqual(normalizeInterests(["sante", " terrain ", "sante", "admin", 3]), ["terrain", "sante"]);
        assert.deepEqual(normalizeInterests(undefined), []);
    });

    it("donne le libelle d'une valeur", () => {
        assert.equal(getInterestLabel("education"), "Éducation et formation");
        assert.equal(getInterestLabel("inconnu"), "inconnu");
    });

    it("est exporte par l'index du paquet", () => {
        assert.equal(shared.INTEREST_AREAS, INTEREST_AREAS);
        assert.equal(typeof shared.isRegionScoped, "function");
    });
});
