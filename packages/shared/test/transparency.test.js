const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
    EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, PUBLIC_DOCUMENT_KINDS, TEAM_GROUPS,
} = require("../src/transparency");

describe("referentiels de transparence", () => {
    it("libelle chaque categorie de depense, sans doublon", () => {
        assert.equal(new Set(EXPENSE_CATEGORIES).size, EXPENSE_CATEGORIES.length);
        for (const category of EXPENSE_CATEGORIES) {
            assert.match(category, /^[a-z_]+$/);
            assert.ok(EXPENSE_CATEGORY_LABELS[category], category);
        }
        assert.ok(EXPENSE_CATEGORIES.includes("other"));
    });

    it("declare les types de documents et les groupes de l'equipe", () => {
        assert.ok(PUBLIC_DOCUMENT_KINDS.includes("annual_report"));
        assert.deepEqual(TEAM_GROUPS, ["team", "volunteers"]);
    });

    it("est accessible par le sous-chemin du paquet", () => {
        assert.equal(require("@hope/shared/transparency").EXPENSE_CATEGORIES, EXPENSE_CATEGORIES);
    });
});
