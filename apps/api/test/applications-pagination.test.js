const { db, resetDatabase, createUser, loginAs } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

// Pagination optionnelle et retrocompatible des listes d'administration.
describe("pagination des candidatures, messages et membres", () => {
    let http;

    before(async () => {
        await resetDatabase();
        const admin = await createUser({ roles: ["admin"] });
        http = await loginAs(admin);
        for (let i = 0; i < 7; i += 1) {
            await db.query(
                "INSERT INTO applications (name, email, motivation, interests) VALUES (?, ?, 'Motivation de test suffisamment longue', '[]')",
                [`Candidat ${i}`, `c${i}@test.hope.org`]
            );
            await db.query(
                "INSERT INTO messages (name, email, subject, content, status) VALUES (?, ?, 'Sujet', 'Contenu du message', ?)",
                [`Auteur ${i}`, `m${i}@test.hope.org`, i < 3 ? "nouveau" : "lu"]
            );
            await createUser({ roles: ["membre"] });
        }
    });

    after(() => db.end());

    it("garde un tableau complet sans parametre page", async () => {
        for (const url of ["/api/admin/applications", "/api/admin/messages", "/api/admin/users"]) {
            const res = await http.get(url);
            assert.equal(res.status, 200, url);
            assert.ok(Array.isArray(res.body), url);
        }
        assert.equal((await http.get("/api/admin/messages")).body.length, 7);
    });

    it("pagine sur demande : { rows, total, page, pageSize }", async () => {
        const first = await http.get("/api/admin/applications?page=1&pageSize=5");
        assert.equal(first.status, 200);
        assert.equal(first.body.total, 7);
        assert.equal(first.body.page, 1);
        assert.equal(first.body.pageSize, 5);
        assert.equal(first.body.rows.length, 5);

        const second = await http.get("/api/admin/applications?page=2&pageSize=5");
        assert.equal(second.body.rows.length, 2);
        const ids = new Set([...first.body.rows, ...second.body.rows].map((row) => row.id));
        assert.equal(ids.size, 7);
    });

    it("combine filtre et pagination", async () => {
        const res = await http.get("/api/admin/messages?status=nouveau&page=1&pageSize=2");
        assert.equal(res.body.total, 3);
        assert.equal(res.body.rows.length, 2);
        assert.ok(res.body.rows.every((row) => row.status === "nouveau"));
    });

    it("pagine les membres avec une taille par defaut", async () => {
        const res = await http.get("/api/admin/users?page=1");
        assert.equal(res.body.pageSize, 25);
        assert.equal(res.body.total, 8);
        assert.equal(res.body.rows[0].password, undefined);
    });

    it("filtre les membres par recherche, role et statut", async () => {
        const finance = await createUser({ roles: ["responsable_finance"], name: "Zoé Trésorière", email: "zoe.tresor@test.hope.org" });
        await db.query("UPDATE users SET status = 'inactive' WHERE id = ?", [finance.id]);

        const byName = await http.get("/api/admin/users?page=1&q=tr%C3%A9sori");
        assert.deepEqual(byName.body.rows.map((user) => user.id), [finance.id]);
        assert.equal(byName.body.total, 1);

        const byRole = await http.get("/api/admin/users?page=1&role=responsable_finance");
        assert.ok(byRole.body.rows.every((user) => user.roles.includes("responsable_finance")));
        assert.ok(byRole.body.rows.some((user) => user.id === finance.id));

        const inactive = await http.get("/api/admin/users?page=1&status=inactive");
        assert.ok(inactive.body.rows.every((user) => user.status === "inactive"));

        // Un joker LIKE saisi est cherche litteralement.
        assert.equal((await http.get("/api/admin/users?page=1&q=%25")).body.total, 0);
        assert.equal((await http.get("/api/admin/users?role=inconnu")).status, 422);
    });

    it("refuse une taille de page superieure a 100", async () => {
        assert.equal((await http.get("/api/admin/users?page=1&pageSize=500")).status, 422);
        assert.equal((await http.get("/api/admin/users?page=0")).status, 422);
    });

    it("renvoie le message mis a jour avec le nom de la personne assignee", async () => {
        const [[message]] = await db.query("SELECT id FROM messages ORDER BY id LIMIT 1");
        const staff = await createUser({ roles: ["organisatrice"], name: "Orga Assignee" });
        const res = await http.patch(`/api/admin/messages/${message.id}`, { status: "traite", assignedTo: staff.id });

        assert.equal(res.status, 200);
        assert.equal(res.body.id, message.id);
        assert.equal(res.body.status, "traite");
        assert.equal(res.body.assigned_name, "Orga Assignee");
        assert.ok(res.body.handled_at);
    });
});
