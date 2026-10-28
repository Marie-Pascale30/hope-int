const { db, resetDatabase, createUser, client, loginAs, setLoginCode, lastLog, PASSWORD } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

// Sans SMTP, les emails s'affichent dans la console : le test y lit le code reellement envoye.
const consoleOutput = (log) => log.mock.calls.map((call) => call.arguments.join(" ")).join("\n");
const lastCode = (log) => {
    const codes = [...consoleOutput(log).matchAll(/Votre code de connexion : (\d{6})/g)];
    return codes.length ? codes[codes.length - 1][1] : null;
};
const cookieNamed = (res, name) => (res.headers["set-cookie"] || []).find((value) => value.startsWith(`${name}=`));

async function startLogin(user, http = client()) {
    const res = await http.post("/api/auth/login", { email: user.email, password: user.password });
    return { http, res };
}

before(() => resetDatabase());
after(() => db.end());

describe("double authentification par code email (comptes de l'equipe)", () => {

    it("connecte directement un compte invite ou membre", async () => {
        for (const roles of [["invite"], ["membre"]]) {
            const { res } = await startLogin(await createUser({ roles }));
            assert.equal(res.status, 200);
            assert.ok(res.body.user);
            assert.equal(res.body.mfaRequired, undefined);
            assert.ok(cookieNamed(res, "hope_session"));
        }
    });

    it("envoie un code au lieu d'ouvrir la session, puis connecte avec ce code", async (t) => {
        const log = t.mock.method(console, "log", () => {});
        const admin = await createUser({ roles: ["admin"] });
        const { http, res } = await startLogin(admin);

        assert.equal(res.status, 200);
        assert.equal(res.body.mfaRequired, true);
        assert.match(res.body.challenge, /^[a-f0-9]{64}$/);
        assert.equal(res.body.user, undefined);
        assert.equal(cookieNamed(res, "hope_session"), undefined, "aucune session avant le code");
        assert.equal((await http.get("/api/auth/me")).status, 401);

        const code = lastCode(log);
        assert.match(code, /^\d{6}$/);
        assert.match(consoleOutput(log), /Votre code de connexion/);
        const [[row]] = await db.query("SELECT code_hash FROM login_challenges WHERE user_id = ?", [admin.id]);
        assert.notEqual(row.code_hash, code, "code stocke sous forme d'empreinte");
        const sent = await lastLog("auth.mfa_sent");
        assert.equal(sent.user_id, admin.id);
        assert.ok(!JSON.stringify(sent.meta).includes(code), "le code n'est pas journalise");

        const verify = await http.post("/api/auth/login/verify", { challenge: res.body.challenge, code });
        assert.equal(verify.status, 200);
        assert.equal(verify.body.user.id, admin.id);
        assert.ok(cookieNamed(verify, "hope_session"));
        assert.equal(cookieNamed(verify, "hope_device"), undefined, "appareil non memorise par defaut");
        assert.equal((await http.get("/api/auth/me")).status, 200);
        assert.equal((await lastLog("auth.mfa_verified")).user_id, admin.id);

        const again = await client().post("/api/auth/login/verify", { challenge: res.body.challenge, code });
        assert.equal(again.status, 400, "code a usage unique");
        assert.equal(again.body.code, "LOGIN_CODE_EXPIRED");
    });

    it("invalide le code apres 5 essais errones", async (t) => {
        const log = t.mock.method(console, "log", () => {});
        const staff = await createUser({ roles: ["organisatrice"] });
        const { http, res } = await startLogin(staff);
        const code = lastCode(log);
        const wrong = code === "000000" ? "111111" : "000000";

        for (let i = 1; i <= 4; i += 1) {
            const attempt = await http.post("/api/auth/login/verify", { challenge: res.body.challenge, code: wrong });
            assert.equal(attempt.status, 400);
            assert.equal(attempt.body.code, "LOGIN_CODE_INVALID");
            assert.equal(attempt.body.details.attemptsLeft, 5 - i);
        }
        const fifth = await http.post("/api/auth/login/verify", { challenge: res.body.challenge, code: wrong });
        assert.equal(fifth.body.code, "LOGIN_CODE_EXPIRED");
        const right = await http.post("/api/auth/login/verify", { challenge: res.body.challenge, code });
        assert.equal(right.status, 400, "le bon code ne sert plus apres 5 echecs");
        assert.equal(right.body.code, "LOGIN_CODE_EXPIRED");
        const failed = await lastLog("auth.mfa_failed");
        assert.equal(failed.user_id, staff.id);
        assert.equal(failed.meta.attempts, 5);
    });

    it("refuse un code expire, un defi inconnu et une saisie invalide", async (t) => {
        const log = t.mock.method(console, "log", () => {});
        const staff = await createUser({ roles: ["responsable_finance"] });
        const { http, res } = await startLogin(staff);
        await db.query("UPDATE login_challenges SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?", [staff.id]);

        const expired = await http.post("/api/auth/login/verify", { challenge: res.body.challenge, code: lastCode(log) });
        assert.equal(expired.status, 400);
        assert.equal(expired.body.code, "LOGIN_CODE_EXPIRED");
        const unknown = await http.post("/api/auth/login/verify", { challenge: "a".repeat(64), code: "123456" });
        assert.equal(unknown.body.code, "LOGIN_CODE_EXPIRED");
        assert.equal((await http.post("/api/auth/login/verify", { challenge: res.body.challenge, code: "12ab56" })).status, 422);
        assert.equal((await http.post("/api/auth/login/verify", { challenge: "court", code: "123456" })).status, 422);
    });

    it("renvoie un nouveau code apres le delai et invalide l'ancien", async (t) => {
        const log = t.mock.method(console, "log", () => {});
        const staff = await createUser({ roles: ["secretaire_generale"] });
        const { http, res } = await startLogin(staff);
        const first = lastCode(log);

        const tooSoon = await http.post("/api/auth/login/resend", { challenge: res.body.challenge });
        assert.equal(tooSoon.status, 429);
        assert.equal(tooSoon.body.code, "LOGIN_CODE_COOLDOWN");
        assert.ok(tooSoon.body.details.retryAfter > 0);

        await db.query("UPDATE login_challenges SET last_sent_at = DATE_SUB(NOW(), INTERVAL 61 SECOND) WHERE user_id = ?", [staff.id]);
        const resent = await http.post("/api/auth/login/resend", { challenge: res.body.challenge });
        assert.equal(resent.status, 200);
        assert.equal(resent.body.resendIn, 60);
        const second = lastCode(log);
        assert.match(second, /^\d{6}$/);

        if (first !== second) {
            const old = await http.post("/api/auth/login/verify", { challenge: res.body.challenge, code: first });
            assert.equal(old.body.code, "LOGIN_CODE_INVALID", "l'ancien code ne vaut plus");
        }
        assert.equal((await http.post("/api/auth/login/verify", { challenge: res.body.challenge, code: second })).status, 200);
    });

    it("limite le nombre de codes envoyes par compte", async () => {
        const staff = await createUser({ roles: ["conseiller"] });
        for (let i = 0; i < 5; i += 1) assert.equal((await startLogin(staff)).res.body.mfaRequired, true);
        const blocked = await startLogin(staff);
        assert.equal(blocked.res.status, 429);
        assert.equal(blocked.res.body.code, "LOGIN_CODE_THROTTLED");
    });

    it("une nouvelle connexion annule le code precedent", async () => {
        const staff = await createUser({ roles: ["responsable_rh"] });
        const first = await startLogin(staff);
        await startLogin(staff);
        const code = await setLoginCode(first.res.body.challenge);
        const res = await first.http.post("/api/auth/login/verify", { challenge: first.res.body.challenge, code });
        assert.equal(res.body.code, "LOGIN_CODE_EXPIRED");
    });

    describe("appareil de confiance", () => {
        async function trustedLogin(user) {
            const { http, res } = await startLogin(user);
            const code = await setLoginCode(res.body.challenge);
            const verify = await http.post("/api/auth/login/verify", { challenge: res.body.challenge, code, trustDevice: true });
            assert.equal(verify.status, 200);
            const cookie = cookieNamed(verify, "hope_device");
            assert.ok(cookie, "cookie hope_device pose");
            return { http, cookie, token: cookie.split(";")[0].split("=")[1] };
        }

        const loginWithDevice = (user, token) =>
            client().agent.post("/api/auth/login")
                .set("X-Requested-With", "XMLHttpRequest")
                .set("Cookie", `hope_device=${token}`)
                .send({ email: user.email, password: user.password });

        it("pose un cookie httpOnly de 30 jours et ne redemande plus le code", async () => {
            const admin = await createUser({ roles: ["admin"] });
            const { cookie, token } = await trustedLogin(admin);

            assert.match(cookie, /HttpOnly/i);
            assert.match(cookie, /Path=\/api\/auth/);
            const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie)[1]);
            assert.equal(maxAge, 30 * 24 * 3600);
            const [[device]] = await db.query("SELECT token_hash FROM trusted_devices WHERE user_id = ?", [admin.id]);
            assert.notEqual(device.token_hash, token, "jeton stocke sous forme d'empreinte");

            const res = await loginWithDevice(admin, token);
            assert.equal(res.status, 200);
            assert.equal(res.body.user.id, admin.id);
            assert.equal(res.body.mfaRequired, undefined);
        });

        it("ne vaut que pour le compte qui l'a obtenu", async () => {
            const { token } = await trustedLogin(await createUser({ roles: ["admin"] }));
            const other = await createUser({ roles: ["admin"] });
            assert.equal((await loginWithDevice(other, token)).body.mfaRequired, true);
        });

        it("est revoque par un changement de mot de passe", async () => {
            const admin = await createUser({ roles: ["admin"] });
            const { http, token } = await trustedLogin(admin);
            const change = await http.post("/api/auth/change-password", { currentPassword: PASSWORD, newPassword: "Nouveau@12345" });
            assert.equal(change.status, 200);

            const res = await loginWithDevice({ ...admin, password: "Nouveau@12345" }, token);
            assert.equal(res.body.mfaRequired, true);
        });

        it("est revoque par la deconnexion de toutes les sessions", async () => {
            const admin = await createUser({ roles: ["admin"] });
            const { http, token } = await trustedLogin(admin);
            assert.equal((await http.post("/api/auth/logout-all")).status, 200);
            assert.equal((await loginWithDevice(admin, token)).body.mfaRequired, true);
        });

        it("expire apres 30 jours", async () => {
            const admin = await createUser({ roles: ["admin"] });
            const { token } = await trustedLogin(admin);
            await db.query("UPDATE trusted_devices SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?", [admin.id]);
            assert.equal((await loginWithDevice(admin, token)).body.mfaRequired, true);
        });
    });

    it("loginAs des tests passe par la verification du code", async () => {
        const http = await loginAs(await createUser({ roles: ["admin"] }));
        assert.equal((await http.get("/api/auth/me")).status, 200);
    });
});

describe("inscription : email de bienvenue", () => {
    it("envoie un email de bienvenue au compte invite cree, jamais au titulaire d'un compte existant", async (t) => {
        const log = t.mock.method(console, "log", () => {});
        const res = await client().post("/api/auth/register", { name: "Nouvel Invite", email: "bienvenue@test.hope.org", password: "Secret@1234" });
        assert.equal(res.status, 201);
        const output = consoleOutput(log);
        assert.match(output, /Objet : HOPE International Project - Bienvenue/);
        assert.match(output, /compte invité/);
        assert.match(output, /\/evenements/);
        assert.match(output, /\/rejoindre/);
        assert.match(output, /\/connexion/);

        log.mock.resetCalls();
        const again = await client().post("/api/auth/register", { name: "Nouvel Invite", email: "bienvenue@test.hope.org", password: "Secret@1234" });
        assert.deepEqual(again.body, res.body);
        assert.doesNotMatch(consoleOutput(log), /Objet : HOPE International Project - Bienvenue/);
        assert.match(consoleOutput(log), /Quelqu'un a tenté de créer un compte/);
    });
});
