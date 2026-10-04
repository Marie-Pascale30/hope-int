const { db, request, app, resetDatabase, createUser, loginAs } = require("./helpers");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("droits sur les routes d'administration", () => {
    let admin, itLead, rh, finance, member;

    before(async () => {
        await resetDatabase();
        admin = await createUser({ roles: ["admin"] });
        itLead = await createUser({ roles: ["responsable_it"] });
        rh = await createUser({ roles: ["responsable_rh"] });
        finance = await createUser({ roles: ["responsable_finance"] });
        member = await createUser({ roles: ["membre"] });
    });

    after(() => db.end());

    it("refuse l'administration sans session", async () => {
        assert.equal((await request(app).get("/api/admin/stats")).status, 401);
    });

    it("refuse l'administration a un simple membre", async () => {
        const http = await loginAs(member);
        assert.equal((await http.get("/api/admin/stats")).status, 403);
    });

    it("donne a chaque role uniquement ses propres droits", async () => {
        const financeHttp = await loginAs(finance);
        assert.equal((await financeHttp.get("/api/admin/donations")).status, 200);
        assert.equal((await financeHttp.get("/api/admin/users")).status, 403);
        assert.equal((await financeHttp.get("/api/admin/system")).status, 403);

        const rhHttp = await loginAs(rh);
        assert.equal((await rhHttp.get("/api/admin/users")).status, 200);
        assert.equal((await rhHttp.get("/api/admin/donations")).status, 403);
    });

    it("exporte les dons en CSV lisible par Excel (BOM UTF-8)", async () => {
        const http = await loginAs(finance);
        const res = await http.get("/api/admin/finance/export").buffer(true).parse((stream, done) => {
            const chunks = [];
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("end", () => done(null, Buffer.concat(chunks)));
        });

        assert.equal(res.status, 200);
        assert.deepEqual([...res.body.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    });

    it("applique immediatement un retrait de droits (roles relus en base)", async () => {
        const user = await createUser({ roles: ["responsable_finance"] });
        const http = await loginAs(user);
        assert.equal((await http.get("/api/admin/donations")).status, 200);

        await db.query("UPDATE users SET role = 'membre', roles = ? WHERE id = ?", [JSON.stringify(["membre"]), user.id]);
        assert.equal((await http.get("/api/admin/donations")).status, 403);
    });

    it("interdit d'attribuer un role disposant de droits qu'on n'a pas", async () => {
        const http = await loginAs(rh);
        const target = await createUser({ roles: ["membre"] });

        const res = await http.patch(`/api/admin/users/${target.id}/roles`, { roles: ["responsable_finance"] });
        assert.equal(res.status, 403);
    });

    it("reserve le role admin aux administrateurs", async () => {
        const http = await loginAs(itLead);
        const target = await createUser({ roles: ["membre"] });

        const res = await http.patch(`/api/admin/users/${target.id}/roles`, { roles: ["admin"] });
        assert.equal(res.status, 403);
    });

    it("interdit de modifier ses propres roles", async () => {
        const http = await loginAs(rh);
        const res = await http.patch(`/api/admin/users/${rh.id}/roles`, { roles: ["membre"] });
        assert.equal(res.status, 403);
    });

    it("laisse un admin retrograder un autre admin tant qu'il en reste un actif", async () => {
        const second = await createUser({ roles: ["admin"] });
        const http = await loginAs(second);

        assert.equal((await http.patch(`/api/admin/users/${admin.id}/roles`, { roles: ["membre"] })).status, 200);
    });

    it("protege le dernier administrateur actif", async () => {
        const userService = require("../services/userService");
        await db.query("UPDATE users SET status = 'inactive' WHERE JSON_CONTAINS(roles, '\"admin\"')");
        const last = await createUser({ roles: ["admin"] });
        // Garde-fou de dernier recours : un acteur admin hors base (aucun autre admin actif).
        const actor = { id: 0, roles: ["admin"] };

        await assert.rejects(userService.updateRoles(actor, last.id, ["membre"]), { status: 403 });
    });

    it("cree un compte avec mot de passe provisoire a changer", async () => {
        const creator = await createUser({ roles: ["admin"] });
        const http = await loginAs(creator);
        const res = await http.post("/api/admin/users", {
            name: "Nouvelle Recrue",
            email: "recrue@test.hope.org",
            roles: ["organisatrice"],
        });

        assert.equal(res.status, 201);
        assert.ok(res.body.tempPassword, "sans SMTP, le mot de passe provisoire est renvoye a l'admin");

        const recruit = await loginAs({ email: "recrue@test.hope.org", password: res.body.tempPassword });
        assert.equal((await recruit.get("/api/admin/events")).body.code, "PASSWORD_CHANGE_REQUIRED");
    });
});
