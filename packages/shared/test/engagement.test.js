const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
    CONSENT_TOPICS, OPT_IN_TOPICS, CAMPAIGN_AUDIENCES, renderTemplate, donorKey, parseDonorKey, isOptInTopic,
} = require("../src/engagement");

describe("referentiels engagement", () => {
    it("la newsletter exige un accord explicite", () => {
        assert.ok(OPT_IN_TOPICS.every((topic) => CONSENT_TOPICS.includes(topic)));
        assert.equal(isOptInTopic("newsletter"), true);
        assert.equal(isOptInTopic("project_news"), false);
        assert.ok(CAMPAIGN_AUDIENCES.includes("newsletter"));
    });

    it("remplace les variables des modeles", () => {
        assert.equal(renderTemplate("Bonjour {prenom} {nom} !", { name: "Ada Love Lace" }), "Bonjour Ada Love Lace !");
        assert.equal(renderTemplate("Bonjour {prenom},", { name: "" }), "Bonjour ,");
        assert.equal(renderTemplate("{inconnu}", { name: "Ada" }), "{inconnu}");
    });

    it("construit et relit une cle de donateur", () => {
        assert.equal(donorKey({ userId: 12, email: "a@b.org" }), "u:12");
        assert.equal(donorKey({ email: " A@B.org " }), "e:a@b.org");
        assert.deepEqual(parseDonorKey("u:12"), { userId: 12 });
        assert.deepEqual(parseDonorKey("e:a@b.org"), { email: "a@b.org" });
        assert.equal(parseDonorKey("u:abc"), null);
        assert.equal(parseDonorKey("x:1"), null);
        assert.equal(parseDonorKey("e:pas-un-email"), null);
    });
});
