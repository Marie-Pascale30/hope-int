const {
    db, request, app, resetDatabase, createUser, createPayment, loginAs, client, mockMethods, multipart, insertProject, insertEvent,
    hoursFromNow, lastLog, PNG_BYTES,
} = require("./fixtures");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const messageRepo = require("../repositories/messageRepository");
const applicationRepo = require("../repositories/applicationRepository");
const stripeProvider = require("../services/payments/stripeProvider");
const impactService = require("../services/impactService");
const { csvCell } = require("../services/adminService");
const { UPLOADS_DIR } = require("../utils/uploads");

const tick = () => new Promise((resolve) => setTimeout(resolve, 50));
const consoleOutput = (log) => log.mock.calls.map((call) => call.arguments.join(" ")).join("\n");

let restore = [];
const mock = (target, methods) => restore.push(mockMethods(target, methods));

describe("administration : droits, listes, actions groupees et supervision", () => {
    let admin, adminHttp, rh, rhHttp, finance, financeHttp, itHttp, member;
    const uploaded = [];

    before(async () => {
        await resetDatabase();
        admin = await createUser({ roles: ["admin"], name: "Alice Admin" });
        rh = await createUser({ roles: ["responsable_rh"], name: "Rita RH" });
        finance = await createUser({ roles: ["responsable_finance"], name: "Fabrice Finance" });
        member = await createUser({ roles: ["membre"], name: "Marc Membre" });
        adminHttp = await loginAs(admin);
        rhHttp = await loginAs(rh);
        financeHttp = await loginAs(finance);
        itHttp = await loginAs(await createUser({ roles: ["responsable_it"] }));
    });

    afterEach(() => {
        restore.reverse().forEach((fn) => fn());
        restore = [];
    });

    after(async () => {
        await tick();
        for (const url of uploaded) await fs.promises.unlink(path.join(UPLOADS_DIR, path.basename(url))).catch(() => {});
        await db.end();
    });

    describe("fiches RH : portee des droits", () => {
        it("interdit de modifier la fiche d'un compte disposant de droits superieurs", async () => {
            const res = await rhHttp.patch(`/api/admin/users/${finance.id}/profile`, { phone: "+237 600 000 001" });
            assert.equal(res.status, 403);
            const [[row]] = await db.query("SELECT phone FROM users WHERE id = ?", [finance.id]);
            assert.equal(row.phone, null);
        });

        it("laisse la RH modifier la fiche d'un membre", async () => {
            const res = await rhHttp.patch(`/api/admin/users/${member.id}/profile`, { phone: "+237 600 000 002", region: "Littoral" });
            assert.equal(res.status, 200);
            assert.equal(res.body.user.region, "Littoral");
        });

        it("interdit a un acteur restreint a sa region de changer sa propre region", async () => {
            const regional = await createUser({ roles: ["directrice_regionale", "responsable_rh"], region: "Centre" });
            const http = await loginAs(regional);
            assert.equal((await http.patch(`/api/admin/users/${regional.id}/profile`, { region: "Littoral" })).status, 403);
            assert.equal((await http.patch(`/api/admin/users/${regional.id}/profile`, { phone: "+237 600 000 003", region: "Centre" })).status, 200);
        });
    });

    describe("candidatures", () => {
        async function submit(email) {
            const res = await client().post("/api/applications", {
                name: "Candidat Test", email, motivation: "Je souhaite rejoindre l'équipe terrain chaque mois avec vous.",
            });
            const [[row]] = await db.query("SELECT id FROM applications WHERE email = ? ORDER BY id DESC LIMIT 1", [email]);
            return { res, id: row?.id };
        }

        it("repond de facon neutre si l'email a deja un compte ou une candidature ouverte", async (t) => {
            const log = t.mock.method(console, "log", () => {});
            const fresh = await submit("candidat-neutre@test.hope.org");
            const duplicate = await submit("candidat-neutre@test.hope.org");
            const existing = await submit(member.email);

            assert.equal(fresh.res.status, 201);
            assert.deepEqual(duplicate.res.body, fresh.res.body);
            assert.deepEqual(existing.res.body, fresh.res.body);
            assert.equal(fresh.res.body.id, undefined);
            assert.equal(existing.id, undefined, "aucune candidature creee pour un compte existant");
            const [[count]] = await db.query("SELECT COUNT(*) AS total FROM applications WHERE email = 'candidat-neutre@test.hope.org'");
            assert.equal(count.total, 1);
            await tick();
            assert.match(consoleOutput(log), /correspond déjà à un compte/);
        });

        it("refuse une candidature, une seule fois", async () => {
            const { id } = await submit("refus@test.hope.org");
            const res = await rhHttp.post(`/api/admin/applications/${id}/reject`, { reviewNote: "Profil incomplet" });
            assert.equal(res.status, 200);
            assert.equal(res.body.status, "refusee");
            assert.equal((await lastLog("application.rejected")).meta.applicationId, id);
            assert.equal((await rhHttp.post(`/api/admin/applications/${id}/reject`, {})).status, 409);
        });

        it("refuse en lot les candidatures encore ouvertes et ignore les autres", async () => {
            const a = await submit("lot-a@test.hope.org");
            const b = await submit("lot-b@test.hope.org");
            const c = await submit("lot-c@test.hope.org");
            await applicationRepo.updateReview(c.id, { status: "acceptee", reviewerId: admin.id });

            const res = await rhHttp.post("/api/admin/applications/bulk-reject", { ids: [a.id, b.id, c.id, 999999], reviewNote: "Session close" });
            assert.equal(res.status, 200);
            assert.deepEqual(res.body, { rejected: 2, skipped: 2 });
            const [rows] = await db.query("SELECT id, status FROM applications WHERE id IN (?) ORDER BY id", [[a.id, b.id, c.id]]);
            assert.deepEqual(rows.map((row) => row.status), ["refusee", "refusee", "acceptee"]);
            const log = await lastLog("application.bulk_rejected");
            assert.deepEqual(log.meta.rejected, [a.id, b.id]);
        });

        it("valide le corps et les droits du refus groupe", async () => {
            assert.equal((await rhHttp.post("/api/admin/applications/bulk-reject", { ids: [] })).status, 422);
            assert.equal((await rhHttp.post("/api/admin/applications/bulk-reject", { ids: Array.from({ length: 101 }, (_v, i) => i + 1) })).status, 422);
            assert.equal((await financeHttp.post("/api/admin/applications/bulk-reject", { ids: [1] })).status, 403);
        });

        it("ne rattache pas une candidature a un compte desactive ou de niveau superieur", async () => {
            const inactive = await createUser({ roles: ["membre"], email: "inactif@test.hope.org" });
            await db.query("UPDATE users SET status = 'inactive' WHERE id = ?", [inactive.id]);
            await applicationRepo.create({ name: "Inactif", email: inactive.email, motivation: "x".repeat(40) });
            const [[first]] = await db.query("SELECT id FROM applications WHERE email = ?", [inactive.email]);
            const res = await adminHttp.post(`/api/admin/applications/${first.id}/accept`, { roles: ["membre"], linkExisting: true });
            assert.equal(res.status, 403);

            const boss = await createUser({ roles: ["responsable_finance"], email: "boss@test.hope.org" });
            await applicationRepo.create({ name: "Boss", email: boss.email, motivation: "x".repeat(40) });
            const [[second]] = await db.query("SELECT id FROM applications WHERE email = ?", [boss.email]);
            const link = await rhHttp.post(`/api/admin/applications/${second.id}/accept`, { roles: ["membre"], linkExisting: true });
            assert.equal(link.status, 403);
            const [[row]] = await db.query("SELECT roles FROM users WHERE id = ?", [boss.id]);
            assert.deepEqual(JSON.parse(row.roles), ["responsable_finance"]);
        });
    });

    describe("messages : changement de statut groupe", () => {
        it("met a jour les messages selectionnes et journalise", async () => {
            const ids = [];
            for (let i = 0; i < 3; i += 1) {
                ids.push(await messageRepo.create({ name: "Visiteur", email: `v${i}@test.hope.org`, subject: "Question", content: "Bonjour, une question." }));
            }
            const res = await adminHttp.patch("/api/admin/messages/bulk", { ids: [ids[0], ids[1]], status: "traite" });
            assert.equal(res.status, 200);
            assert.deepEqual(res.body, { updated: 2 });
            const [rows] = await db.query("SELECT status, handled_at FROM messages WHERE id IN (?) ORDER BY id", [ids]);
            assert.deepEqual(rows.map((row) => row.status), ["traite", "traite", "nouveau"]);
            assert.ok(rows[0].handled_at);
            assert.equal((await lastLog("message.bulk_updated")).meta.updated, 2);
        });

        it("valide le corps et les droits", async () => {
            assert.equal((await adminHttp.patch("/api/admin/messages/bulk", { ids: [1], status: "inconnu" })).status, 422);
            assert.equal((await adminHttp.patch("/api/admin/messages/bulk", { ids: "1", status: "lu" })).status, 422);
            assert.equal((await financeHttp.patch("/api/admin/messages/bulk", { ids: [1], status: "lu" })).status, 403);
        });
    });

    describe("listes et journal", () => {
        it("GET /admin/staff : equipe active uniquement, filtree en SQL", async () => {
            const gone = await createUser({ roles: ["organisatrice"], name: "Zoe Partie" });
            await db.query("UPDATE users SET status = 'inactive' WHERE id = ?", [gone.id]);
            const res = await financeHttp.get("/api/admin/staff");
            assert.equal(res.status, 200);
            const ids = res.body.map((user) => user.id);
            assert.ok(ids.includes(admin.id) && ids.includes(rh.id));
            assert.ok(!ids.includes(member.id), "pas de simple membre");
            assert.ok(!ids.includes(gone.id), "pas de compte inactif");
            assert.deepEqual(Object.keys(res.body[0]).sort(), ["id", "name", "roles"]);
        });

        it("GET /admin/logs : pagination et filtre par action", async () => {
            const res = await adminHttp.get("/api/admin/logs?limit=2&action=auth.login");
            assert.equal(res.status, 200);
            assert.ok(res.body.total >= 4);
            assert.equal(res.body.items.length, 2);
            assert.ok(res.body.items.every((item) => item.action.startsWith("auth.login")));
            assert.equal((await financeHttp.get("/api/admin/logs")).status, 403);
            assert.equal((await adminHttp.get("/api/admin/logs?limit=1000")).status, 422);
        });

        it("GET /admin/donations : pagination serveur ou total dans X-Total-Count", async () => {
            await db.query("DELETE FROM payments");
            for (let i = 0; i < 3; i += 1) await createPayment({ status: "succeeded" });
            const page = await financeHttp.get("/api/admin/donations?page=1&pageSize=2");
            assert.equal(page.status, 200);
            assert.equal(page.body.rows.length, 2);
            assert.equal(page.body.total, 3);
            assert.equal(page.body.page, 1);
            assert.equal(page.body.pageSize, 2);

            const all = await financeHttp.get("/api/admin/donations");
            assert.ok(Array.isArray(all.body));
            assert.equal(all.headers["x-total-count"], "3");
        });

        it("expose X-Total-Count au site (CORS)", async () => {
            const res = await financeHttp.get("/api/admin/donations").set("Origin", "http://localhost:3001");
            assert.match(res.headers["access-control-expose-headers"], /X-Total-Count/);
        });
    });

    describe("export CSV", () => {
        it("ajoute rembourse, net et equivalent EUR", async () => {
            await db.query("DELETE FROM payments");
            await createPayment({ status: "succeeded", amount: 100, refunded_amount: 30, donor_name: "=HYPERLINK(1)" });
            await createPayment({ status: "succeeded", amount: 6559.57, currency: "xaf", donor_name: "\tcellule" });
            const res = await financeHttp.get("/api/admin/finance/export");
            assert.equal(res.status, 200);
            const [header, ...lines] = res.text.replace(/^\uFEFF/, "").split("\r\n");
            const columns = header.split(";");
            for (const label of ["Remboursé", "Net", "Équivalent EUR"]) assert.ok(columns.includes(label), label);
            const cell = (line, label) => line.split(";")[columns.indexOf(label)];
            const eur = lines.find((line) => cell(line, "Devise") === "eur");
            assert.equal(cell(eur, "Montant"), "100,00");
            assert.equal(cell(eur, "Remboursé"), "30,00");
            assert.equal(cell(eur, "Net"), "70,00");
            assert.equal(cell(eur, "Équivalent EUR"), "70,00");
            assert.equal(cell(eur, "Donateur"), "'=HYPERLINK(1)");
            const xaf = lines.find((line) => cell(line, "Devise") === "xaf");
            assert.equal(cell(xaf, "Équivalent EUR"), "10,00");
            assert.equal(cell(xaf, "Donateur"), "'\tcellule");
        });

        it("neutralise les formules, y compris apres tabulation ou retour chariot", () => {
            assert.equal(csvCell("=1+1"), "'=1+1");
            assert.equal(csvCell("\t=1"), "'\t=1");
            assert.equal(csvCell("\r=1"), "\"'\r=1\"");
            assert.equal(csvCell("a;b"), "\"a;b\"");
            assert.equal(csvCell(null), "");
            assert.equal(csvCell(new Date("2026-01-02T03:04:05Z")), "2026-01-02T03:04:05.000Z");
        });
    });

    describe("finance : rapprochement via HTTP", () => {
        it("relit les dons en attente chez le prestataire et enregistre la derniere execution", async () => {
            const payment = await createPayment({ transaction_id: "pi_http_reconcile" });
            await db.query("UPDATE payments SET created_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?", [payment.id]);
            mock(stripeProvider, { isEnabled: () => true, retrieveIntent: async () => ({ status: "succeeded", paidAt: null }) });

            const res = await financeHttp.post("/api/admin/finance/reconcile");
            assert.equal(res.status, 200);
            assert.ok(res.body.succeeded >= 1);
            const [[row]] = await db.query("SELECT status FROM payments WHERE id = ?", [payment.id]);
            assert.equal(row.status, "succeeded");
            assert.equal((await lastLog("finance.reconcile")).meta.source, "manual");

            const system = await itHttp.get("/api/admin/system");
            assert.equal(system.body.reconcile.lastRun.source, "manual");
            assert.ok(system.body.reconcile.lastRun.summary.checked >= 1);
        });

        it("refuse un second rapprochement simultane (verrou MySQL)", async () => {
            const connection = await db.getConnection();
            try {
                await connection.query("SELECT GET_LOCK('hope_payments_reconcile', 0)");
                const res = await financeHttp.post("/api/admin/finance/reconcile");
                assert.equal(res.status, 409);
                assert.equal(res.body.code, "RECONCILE_RUNNING");
            } finally {
                await connection.query("SELECT RELEASE_LOCK('hope_payments_reconcile')");
                connection.release();
            }
        });

        it("reserve le rapprochement a la finance", async () => {
            assert.equal((await rhHttp.post("/api/admin/finance/reconcile")).status, 403);
        });
    });

    describe("supervision", () => {
        it("GET /admin/system renvoie l'etat de la base et les controles", async () => {
            const res = await itHttp.get("/api/admin/system");
            assert.equal(res.status, 200);
            assert.equal(res.body.database.ok, true);
            assert.match(res.body.database.version, /^\d+\./);
            assert.ok(res.body.tables.users >= 1);
            assert.ok(res.body.checks.some((check) => check.key === "stripe"));
        });

        it("/api/health reste minimal et /api/health/details est protege", async () => {
            assert.deepEqual((await request(app).get("/api/health")).body, { status: "ok" });
            assert.equal((await request(app).get("/api/health/details")).status, 401);
            assert.equal((await financeHttp.get("/api/health/details")).status, 403);

            const res = await itHttp.get("/api/health/details");
            assert.equal(res.status, 200);
            assert.equal(res.body.status, "ok");
            assert.equal(res.body.database.ok, true);
            assert.deepEqual(res.body.migrations.pending, []);
            assert.match(res.body.migrations.latest, /^\d{3}_/);
            assert.equal(typeof res.body.emailOutbox.pending, "number");
            assert.ok("lastRun" in res.body.reconcile);
        });

        it("accepte le jeton HEALTH_TOKEN sans session", async () => {
            process.env.HEALTH_TOKEN = "jeton-de-supervision-0123456789";
            try {
                const ok = await request(app).get("/api/health/details").set("X-Health-Token", "jeton-de-supervision-0123456789");
                assert.equal(ok.status, 200);
                const wrong = await request(app).get("/api/health/details").set("X-Health-Token", "mauvais");
                assert.equal(wrong.status, 401);
            } finally {
                delete process.env.HEALTH_TOKEN;
            }
        });

        it("met en cache les chiffres d'impact publics", async () => {
            impactService.clearCache();
            const first = await request(app).get("/api/impact");
            await insertProject({ title: "Nouveau projet", beneficiaries: 500 });
            const cached = await request(app).get("/api/impact");
            assert.deepEqual(cached.body, first.body);
            impactService.clearCache();
            const fresh = await request(app).get("/api/impact");
            assert.equal(fresh.body.beneficiaries, first.body.beneficiaries + 500);
        });
    });

    describe("texte alternatif des images (image_alt)", () => {
        it("enregistre image_alt sur un contenu et le renvoie publiquement", async () => {
            const res = await multipart(adminHttp, "post", "/api/admin/content/projects", {
                title: "Puits", description: "Projet de puits", published: "1", image_alt: "Enfants autour d'un puits",
            }, { buffer: PNG_BYTES, filename: "puits.png", contentType: "image/png" });
            assert.equal(res.status, 201);
            uploaded.push(res.body.image_url);
            assert.equal(res.body.image_alt, "Enfants autour d'un puits");
            const pub = await request(app).get(`/api/content/projects/${res.body.id}`);
            assert.equal(pub.body.image_alt, "Enfants autour d'un puits");

            const cleared = await multipart(adminHttp, "patch", `/api/admin/content/projects/${res.body.id}`, { image_alt: "" });
            assert.equal(cleared.body.image_alt, null);
            const tooLong = await multipart(adminHttp, "patch", `/api/admin/content/projects/${res.body.id}`, { image_alt: "x".repeat(256) });
            assert.equal(tooLong.status, 422);
        });

        it("enregistre image_alt sur un evenement", async () => {
            const id = await insertEvent({ startAt: hoursFromNow(48) });
            const res = await adminHttp.patch(`/api/admin/events/${id}`, { image_alt: "Affiche de la collecte" });
            assert.equal(res.status, 200);
            assert.equal(res.body.image_alt, "Affiche de la collecte");
            assert.equal((await request(app).get(`/api/events/${id}`)).body.image_alt, "Affiche de la collecte");
        });
    });

    describe("evenements : information des inscrits", () => {
        it("previent les inscrits d'une modification puis d'un retrait de l'agenda", async (t) => {
            const id = await insertEvent({ title: "Collecte", startAt: hoursFromNow(72) });
            await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [id, member.id]);
            const log = t.mock.method(console, "log", () => {});

            await adminHttp.patch(`/api/admin/events/${id}`, { description: "Nouvelle description de l'événement" });
            await tick();
            assert.doesNotMatch(consoleOutput(log), /Événement modifié/, "un champ sans incidence ne declenche rien");

            const moved = await adminHttp.patch(`/api/admin/events/${id}`, { location: "Yaoundé" });
            assert.equal(moved.status, 200);
            await tick();
            assert.match(consoleOutput(log), /Événement modifié : Collecte/);
            assert.match(consoleOutput(log), /Lieu : Yaoundé/);
            assert.equal((await lastLog("event.update")).meta.notified, 1);

            await adminHttp.patch(`/api/admin/events/${id}`, { published: "0" });
            await tick();
            assert.match(consoleOutput(log), /retiré de l'agenda/);
        });

        it("ne previent personne pour un evenement passe", async (t) => {
            const id = await insertEvent({ title: "Ancien", startAt: hoursFromNow(-48), endAt: hoursFromNow(-47) });
            await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [id, member.id]);
            const log = t.mock.method(console, "log", () => {});
            await adminHttp.patch(`/api/admin/events/${id}`, { location: "Bafoussam" });
            await tick();
            assert.doesNotMatch(consoleOutput(log), /Ancien/);
        });
    });
});
