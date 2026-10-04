const { db, request, app, resetDatabase, createUser, client, loginAs, PASSWORD } = require("./helpers");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("authentification par cookie", () => {
    let member;

    before(async () => {
        await resetDatabase();
        member = await createUser({ roles: ["membre"] });
    });

    after(() => db.end());

    it("pose un cookie httpOnly et ne renvoie jamais le jeton dans le corps", async () => {
        const res = await client().post("/api/auth/login", { email: member.email, password: PASSWORD });

        assert.equal(res.status, 200);
        assert.equal(res.body.token, undefined);
        assert.equal(res.body.user.email, member.email);
        const cookie = res.headers["set-cookie"].find((value) => value.startsWith("hope_session="));
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);
        assert.match(cookie, /Path=\/api/);
    });

    it("refuse un mauvais mot de passe sans poser de cookie", async () => {
        const res = await client().post("/api/auth/login", { email: member.email, password: "Mauvais@123" });

        assert.ok(res.status >= 400 && res.status < 500);
        assert.equal(res.headers["set-cookie"], undefined);
    });

    it("identifie l'utilisateur grace au cookie", async () => {
        const http = await loginAs(member);
        const res = await http.get("/api/auth/me");

        assert.equal(res.status, 200);
        assert.equal(res.body.email, member.email);
    });

    it("exige une authentification sur /auth/me", async () => {
        const res = await request(app).get("/api/auth/me");
        assert.equal(res.status, 401);
    });

    it("rejette une ecriture authentifiee par cookie sans en-tete CSRF", async () => {
        const http = await loginAs(member);
        const res = await http.agent.patch("/api/auth/me").send({ name: "Pirate" });

        assert.equal(res.status, 403);
        assert.equal(res.body.code, "CSRF_REJECTED");
    });

    it("accepte toujours un jeton Bearer (scripts et outils)", async () => {
        const authService = require("../services/authService");
        const { token } = await authService.login(member.email, PASSWORD);
        const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

        assert.equal(res.status, 200);
    });

    it("ne modifie que les champs envoyes sur le profil", async () => {
        const http = await loginAs(member);
        const initial = await http.get("/api/auth/me");
        const res = await http.patch("/api/auth/me", { phone: "+237 600 000 000" });

        assert.equal(res.status, 200);
        assert.equal(res.body.phone, "+237 600 000 000");
        assert.equal(res.body.name, initial.body.name);
    });

    it("ferme la session a la deconnexion", async () => {
        const http = await loginAs(member);
        const logout = await http.post("/api/auth/logout");
        const me = await http.get("/api/auth/me");

        assert.equal(logout.status, 200);
        assert.equal(me.status, 401);
    });

    it("invalide les anciennes sessions apres un changement de mot de passe", async () => {
        const user = await createUser();
        const oldSession = await loginAs(user);
        const current = await loginAs(user);

        const res = await current.post("/api/auth/change-password", {
            currentPassword: PASSWORD,
            newPassword: "Nouveau@12345",
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.token, undefined);
        assert.equal((await current.get("/api/auth/me")).status, 200, "la session courante continue avec le nouveau cookie");
        assert.equal((await oldSession.get("/api/auth/me")).status, 401, "les autres sessions sont fermees");
    });

    it("bloque tout sauf le changement de mot de passe pour un mot de passe provisoire", async () => {
        const user = await createUser({ roles: ["responsable_finance"], mustChangePassword: true });
        const http = await loginAs(user);

        assert.equal((await http.get("/api/auth/me")).status, 200);
        const blocked = await http.get("/api/admin/donations");
        assert.equal(blocked.status, 403);
        assert.equal(blocked.body.code, "PASSWORD_CHANGE_REQUIRED");
    });

    it("signale un lien de reinitialisation invalide par un code", async () => {
        const res = await client().post("/api/auth/reset-password", { token: "a".repeat(64), password: "Nouveau@12345" });

        assert.equal(res.status, 400);
        assert.equal(res.body.code, "RESET_LINK_INVALID");
    });

    it("envoie un lien de reinitialisation dans la langue de la demande", async () => {
        const user = await createUser();
        const logs = [];
        const original = console.log;
        console.log = (...args) => logs.push(args.join(" "));
        try {
            await client().post("/api/auth/forgot-password", { email: user.email }).set("Accept-Language", "es");
        } finally {
            console.log = original;
        }

        assert.match(logs.join("\n"), /\/es\/reinitialiser-mot-de-passe\?token=[0-9a-f]+/);
    });

    it("refuse un compte desactive", async () => {
        const user = await createUser();
        const http = await loginAs(user);
        await db.query("UPDATE users SET status = 'inactive' WHERE id = ?", [user.id]);

        assert.equal((await http.get("/api/auth/me")).status, 401);
    });
});
