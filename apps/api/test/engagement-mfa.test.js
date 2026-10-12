const { db, request, app, resetDatabase, createUser, client, loginAs, PASSWORD } = require("./helpers");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const totp = require("../services/engagementTotp");
const authService = require("../services/authService");

const STEP_MS = 30 * 1000;

// Code valide pour le pas suivant de celui deja utilise (anti-rejeu : chaque pas ne sert qu'une fois).
async function nextCode(userId, secretBase32) {
    const [[row]] = await db.query("SELECT last_used_step FROM user_mfa WHERE user_id = ?", [userId]);
    const current = totp.stepAt();
    const last = row?.last_used_step === null || row?.last_used_step === undefined ? current - 2 : Number(row.last_used_step);
    const step = Math.max(current - 1, last + 1);
    if (step > current + 1) throw new Error("plus de pas disponible dans la fenetre");
    return totp.hotp(totp.base32Decode(secretBase32), step);
}

async function enroll(http, userId) {
    const setup = await http.post("/api/auth/mfa/setup");
    assert.equal(setup.status, 200, JSON.stringify(setup.body));
    const enable = await http.post("/api/auth/mfa/enable", { code: await nextCode(userId, setup.body.secret) });
    assert.equal(enable.status, 200, JSON.stringify(enable.body));
    return { secret: setup.body.secret, backupCodes: enable.body.backupCodes };
}

describe("engagement : TOTP (RFC 6238)", () => {
    it("respecte les vecteurs de test de la RFC (SHA1)", () => {
        const secret = Buffer.from("12345678901234567890");
        assert.equal(totp.generate(secret, 59 * 1000), "287082");
        assert.equal(totp.generate(secret, 1111111109 * 1000), "081804");
        assert.equal(totp.generate(secret, 1234567890 * 1000), "005924");
        assert.equal(totp.generate(secret, 2000000000 * 1000), "279037");
    });

    it("accepte une derive d'un pas, pas davantage", () => {
        const secret = totp.newSecret();
        const now = Date.now();
        const code = totp.generate(secret, now);
        assert.equal(totp.verify(secret, code, { timeMs: now }), totp.stepAt(now));
        assert.ok(totp.verify(secret, code, { timeMs: now + STEP_MS }) !== null);
        assert.ok(totp.verify(secret, code, { timeMs: now - STEP_MS }) !== null);
        assert.equal(totp.verify(secret, code, { timeMs: now + 3 * STEP_MS }), null);
        assert.equal(totp.verify(secret, "12345", { timeMs: now }), null);
        assert.equal(totp.verify(secret, "abcdef", { timeMs: now }), null);
    });

    it("encode et decode le base32, chiffre le secret au repos", () => {
        const secret = totp.newSecret();
        assert.deepEqual(totp.base32Decode(totp.base32Encode(secret)), secret);
        const stored = totp.encryptSecret(secret);
        assert.equal(stored.includes(totp.base32Encode(secret)), false);
        assert.deepEqual(totp.decryptSecret(stored), secret);
        const tampered = stored.slice(0, -4) + (stored.endsWith("AAAA") ? "BBBB" : "AAAA");
        assert.throws(() => totp.decryptSecret(tampered));
        assert.match(totp.otpauthUrl({ secret, account: "a@b.org", issuer: "HOPE" }), /^otpauth:\/\/totp\/HOPE%3Aa%40b\.org\?secret=/);
    });
});

describe("engagement : double authentification", () => {
    let member;
    let finance;
    let admin;

    before(async () => {
        await resetDatabase();
        member = await createUser({ roles: ["membre"] });
        finance = await createUser({ roles: ["responsable_finance"] });
        admin = await createUser({ roles: ["admin"] });
    });

    afterEach(() => {
        delete process.env.MFA_REQUIRED_PERMISSIONS;
    });

    after(() => db.end());

    it("active la double authentification facultative depuis la session, puis l'exige a la connexion", async () => {
        const http = await loginAs(member);
        const status = await http.get("/api/auth/mfa/status");
        assert.deepEqual(status.body, { enabled: false, required: false, backupCodesRemaining: 0 });

        const { secret, backupCodes } = await enroll(http, member.id);
        assert.equal(backupCodes.length, 10);
        assert.equal((await http.get("/api/auth/mfa/status")).body.enabled, true, "la session courante est renouvelee");

        // Connexion : mot de passe seul insuffisant.
        const fresh = client();
        const login = await fresh.post("/api/auth/login", { email: member.email, password: PASSWORD });
        assert.equal(login.status, 200);
        assert.equal(login.body.mfaRequired, "verify");
        assert.equal(login.body.user, undefined);
        const cookies = login.headers["set-cookie"].join(";");
        assert.doesNotMatch(cookies, /hope_session=[^;]/);
        assert.match(cookies, /hope_mfa=.+HttpOnly/);
        assert.equal((await fresh.get("/api/auth/me")).status, 401);

        const wrong = await fresh.post("/api/auth/mfa/verify", { code: "000000" });
        assert.equal(wrong.status, 400);

        const code = await nextCode(member.id, secret);
        const ok = await fresh.post("/api/auth/mfa/verify", { code });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.user.email, member.email);
        assert.equal((await fresh.get("/api/auth/me")).status, 200);

        // Rejeu du meme code : refuse.
        const replay = client();
        await replay.post("/api/auth/login", { email: member.email, password: PASSWORD });
        const replayed = await replay.post("/api/auth/mfa/verify", { code });
        assert.equal(replayed.status, 400);
        assert.equal(replayed.body.code, "MFA_CODE_INVALID");
    });

    it("accepte un code de secours une seule fois", async () => {
        const user = await createUser({ roles: ["membre"] });
        const { backupCodes } = await enroll(await loginAs(user), user.id);

        const first = client();
        await first.post("/api/auth/login", { email: user.email, password: PASSWORD });
        const used = await first.post("/api/auth/mfa/verify", { code: backupCodes[0].toUpperCase() });
        assert.equal(used.status, 200);

        const second = client();
        await second.post("/api/auth/login", { email: user.email, password: PASSWORD });
        assert.equal((await second.post("/api/auth/mfa/verify", { code: backupCodes[0] })).status, 400);
        assert.equal((await second.post("/api/auth/mfa/verify", { code: backupCodes[1] })).status, 200);

        const [[row]] = await db.query("SELECT COUNT(*) AS total FROM user_mfa_backup_codes WHERE user_id = ? AND used_at IS NULL", [user.id]);
        assert.equal(row.total, 8);
        const [hashes] = await db.query("SELECT code_hash FROM user_mfa_backup_codes WHERE user_id = ?", [user.id]);
        assert.ok(hashes.every((h) => !backupCodes.map((c) => c.replace("-", "")).includes(h.code_hash)), "codes stockes haches");
    });

    it("refuse un jeton de verification absent, falsifie ou devenu caduc", async () => {
        assert.equal((await client().post("/api/auth/mfa/verify", { code: "123456" })).status, 401);
        const forged = await request(app).post("/api/auth/mfa/verify").set("Cookie", "hope_mfa=abc.def.ghi").send({ code: "123456" });
        assert.equal(forged.status, 401);
        assert.equal(forged.body.code, "MFA_CHALLENGE_INVALID");
        // Un jeton de session n'est pas un jeton de verification.
        const user = await createUser({ roles: ["membre"] });
        const { token } = await authService.login(user.email, PASSWORD);
        const wrongPurpose = await request(app).post("/api/auth/mfa/verify").set("Cookie", `hope_mfa=${token}`).send({ code: "123456" });
        assert.equal(wrongPurpose.status, 401);
    });

    it("bloque apres 5 codes incorrects", async () => {
        const user = await createUser({ roles: ["membre"] });
        await enroll(await loginAs(user), user.id);
        const http = client();
        await http.post("/api/auth/login", { email: user.email, password: PASSWORD });
        for (let i = 0; i < 5; i += 1) assert.equal((await http.post("/api/auth/mfa/verify", { code: "111111" })).status, 400);
        const blocked = await http.post("/api/auth/mfa/verify", { code: "111111" });
        assert.equal(blocked.status, 429);
    });

    it("oblige un compte sensible a s'equiper avant d'obtenir une session", async () => {
        process.env.MFA_REQUIRED_PERMISSIONS = "manage_finance,manage_user_roles,delete_users,manage_it";
        const http = client();
        const login = await http.post("/api/auth/login", { email: finance.email, password: PASSWORD });
        assert.equal(login.body.mfaRequired, "setup");
        assert.equal((await http.get("/api/auth/me")).status, 401);
        // Le jeton "setup" ne permet pas de court-circuiter la verification.
        assert.equal((await http.post("/api/auth/mfa/verify", { code: "123456" })).status, 401);

        const { secret } = await enroll(http, finance.id);
        const me = await http.get("/api/auth/me");
        assert.equal(me.status, 200);
        assert.equal(me.body.email, finance.email);

        // Obligatoire : desactivation refusee.
        const disable = await http.post("/api/auth/mfa/disable", { password: PASSWORD, code: await nextCode(finance.id, secret) });
        assert.equal(disable.status, 403);

        // Un membre simple n'est pas concerne.
        const memberLogin = await client().post("/api/auth/login", { email: (await createUser()).email, password: PASSWORD });
        assert.ok(memberLogin.body.user);
    });

    it("desactive la double authentification facultative avec mot de passe et code", async () => {
        const user = await createUser({ roles: ["membre"] });
        const http = await loginAs(user);
        const { secret } = await enroll(http, user.id);
        assert.equal((await http.post("/api/auth/mfa/disable", { password: "Mauvais123", code: await nextCode(user.id, secret) })).status, 400);
        const ok = await http.post("/api/auth/mfa/disable", { password: PASSWORD, code: await nextCode(user.id, secret) });
        assert.equal(ok.status, 200);
        const login = await client().post("/api/auth/login", { email: user.email, password: PASSWORD });
        assert.ok(login.body.user);
    });

    it("regenere les codes de secours", async () => {
        const user = await createUser({ roles: ["membre"] });
        const http = await loginAs(user);
        const { secret, backupCodes } = await enroll(http, user.id);
        const res = await http.post("/api/auth/mfa/backup-codes", { code: await nextCode(user.id, secret) });
        assert.equal(res.status, 200);
        assert.equal(res.body.backupCodes.length, 10);
        assert.notDeepEqual(res.body.backupCodes, backupCodes);
    });

    it("permet a un administrateur de reinitialiser la double authentification d'un compte", async () => {
        const user = await createUser({ roles: ["membre"] });
        const userHttp = await loginAs(user);
        await enroll(userHttp, user.id);

        const memberHttp = await loginAs(await createUser({ roles: ["membre"] }));
        const denied = await memberHttp.post(`/api/engagement/security/users/${user.id}/mfa/reset`);
        assert.equal(denied.status, 403);

        const adminHttp = await loginAs(admin);
        const status = await adminHttp.get(`/api/engagement/security/mfa?ids=${user.id},${admin.id}`);
        assert.equal(status.status, 200);
        assert.equal(status.body.find((row) => row.id === user.id).enabled, true);

        const self = await adminHttp.post(`/api/engagement/security/users/${admin.id}/mfa/reset`);
        assert.equal(self.status, 403);
        const reset = await adminHttp.post(`/api/engagement/security/users/${user.id}/mfa/reset`);
        assert.equal(reset.status, 200);
        assert.equal((await userHttp.get("/api/auth/me")).status, 401, "sessions fermees");
        const login = await client().post("/api/auth/login", { email: user.email, password: PASSWORD });
        assert.ok(login.body.user, "plus de second facteur");
    });
});
