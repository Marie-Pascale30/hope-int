const { db, resetDatabase } = require("./helpers");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { runMigrations, status, listMigrations } = require("../config/migrate");

describe("migrations", () => {
    before(() => resetDatabase());
    after(() => db.end());

    it("applique toutes les migrations sur une base vide", async () => {
        const states = await status();

        assert.equal(states.length, listMigrations().length);
        assert.ok(states.every((migration) => migration.applied));
    });

    it("n'applique rien une seconde fois", async () => {
        assert.deepEqual(await runMigrations({ log: () => {} }), []);
    });

    it("garde la migration de reference rejouable sur un schema existant", async () => {
        await require("../migrations/001_baseline").up({ db });

        const [columns] = await db.query(
            "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
        );
        const names = columns.map((column) => column.name);
        for (const expected of ["roles", "status", "must_change_password", "token_version"]) {
            assert.ok(names.includes(expected), `colonne users.${expected} manquante`);
        }
    });
});
