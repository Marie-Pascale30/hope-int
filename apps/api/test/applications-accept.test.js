const { db, request, app, resetDatabase, createUser, loginAs, client, PASSWORD } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { INTEREST_AREAS } = require("@hope/shared/applications");

let counter = 0;
async function submitApplication(overrides = {}) {
    counter += 1;
    const body = {
        name: "Candidate Test",
        email: `candidate${counter}@test.hope.org`,
        region: "Littoral",
        motivation: "Je souhaite m'engager auprès de l'association sur le terrain chaque mois.",
        interests: ["terrain", "sante"],
        ...overrides,
    };
    const res = await client().post("/api/applications", body);
    return { res, email: body.email };
}

describe("candidatures : poles d'interet et acceptation", () => {
    let rh, rhHttp, admin, adminHttp;

    before(async () => {
        await resetDatabase();
        rh = await createUser({ roles: ["responsable_rh"] });
        admin = await createUser({ roles: ["admin"] });
        rhHttp = await loginAs(rh);
        adminHttp = await loginAs(admin);
    });

    after(() => db.end());

    describe("depot public", () => {
        it("expose les poles d'interet dans /api/meta (et plus les roles)", async () => {
            const res = await request(app).get("/api/meta");
            assert.equal(res.status, 200);
            assert.deepEqual(res.body.interestAreas, INTEREST_AREAS);
            assert.equal(res.body.applicationRoles, undefined);
        });

        it("enregistre les poles d'interet et ignore les roles demandes", async () => {
            const { res } = await submitApplication({ desiredRoles: ["responsable_finance"] });
            assert.equal(res.status, 201);

            const [[row]] = await db.query("SELECT interests, desired_roles FROM applications WHERE id = ?", [res.body.id]);
            assert.deepEqual(JSON.parse(row.interests), ["terrain", "sante"]);
            assert.equal(row.desired_roles, null);
        });

        it("refuse un pole d'interet inconnu", async () => {
            const { res } = await submitApplication({ interests: ["admin"] });
            assert.equal(res.status, 422);
        });

        it("renvoie les poles d'interet dans la liste d'administration", async () => {
            const res = await rhHttp.get("/api/admin/applications");
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.body));
            assert.ok(res.body.some((row) => Array.isArray(row.interests) && row.interests.includes("terrain")));
        });
    });

    describe("acceptation", () => {
        it("exige des roles explicites", async () => {
            const { res } = await submitApplication();
            const accept = await rhHttp.post(`/api/admin/applications/${res.body.id}/accept`, {});
            assert.equal(accept.status, 422);
            const empty = await rhHttp.post(`/api/admin/applications/${res.body.id}/accept`, { roles: [] });
            assert.equal(empty.status, 422);
        });

        it("cree le compte avec les roles choisis et clot la candidature", async () => {
            const { res, email } = await submitApplication();
            const accept = await rhHttp.post(`/api/admin/applications/${res.body.id}/accept`, { roles: ["membre"] });

            assert.equal(accept.status, 200);
            assert.equal(accept.body.linkedExisting, false);
            assert.deepEqual(accept.body.user.roles, ["membre"]);
            assert.ok(accept.body.tempPassword);
            assert.equal(accept.body.application.status, "acceptee");
            assert.equal(accept.body.application.user_id, accept.body.user.id);
            const [[user]] = await db.query("SELECT must_change_password FROM users WHERE email = ?", [email]);
            assert.equal(user.must_change_password, 1);
        });

        it("refuse un role que l'acteur ne peut pas attribuer, sans rien creer", async () => {
            const { res, email } = await submitApplication();
            const accept = await rhHttp.post(`/api/admin/applications/${res.body.id}/accept`, { roles: ["responsable_finance"] });

            assert.equal(accept.status, 403);
            const [users] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
            assert.equal(users.length, 0);
        });

        it("refuse une seconde acceptation", async () => {
            const { res } = await submitApplication();
            assert.equal((await rhHttp.post(`/api/admin/applications/${res.body.id}/accept`, { roles: ["membre"] })).status, 200);
            const again = await rhHttp.post(`/api/admin/applications/${res.body.id}/accept`, { roles: ["membre"] });
            assert.equal(again.status, 409);
            assert.equal(again.body.code, "APPLICATION_CLOSED");
        });

        it("ne cree qu'un seul compte en cas d'acceptations simultanees (transaction)", async () => {
            const { res, email } = await submitApplication();
            const url = `/api/admin/applications/${res.body.id}/accept`;
            const results = await Promise.all([
                rhHttp.post(url, { roles: ["membre"] }),
                adminHttp.post(url, { roles: ["membre"] }),
            ]);

            const statuses = results.map((r) => r.status).sort();
            assert.equal(statuses.filter((status) => status === 200).length, 1, `statuts : ${statuses}`);
            const [users] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
            assert.equal(users.length, 1);
            const [[application]] = await db.query("SELECT status, user_id FROM applications WHERE id = ?", [res.body.id]);
            assert.equal(application.status, "acceptee");
            assert.equal(application.user_id, users[0].id);
        });

        it("annule la creation du compte si la candidature a ete close entre-temps", async () => {
            const { res, email } = await submitApplication();
            const applicationRepo = require("../repositories/applicationRepository");
            const original = applicationRepo.updateReview;
            // Simule une decision concurrente juste avant la cloture conditionnelle.
            applicationRepo.updateReview = async (id, data, connection) => {
                await db.query("UPDATE applications SET status = 'refusee' WHERE id = ?", [id]);
                return original(id, data, connection);
            };
            try {
                const accept = await rhHttp.post(`/api/admin/applications/${res.body.id}/accept`, { roles: ["membre"] });
                assert.equal(accept.status, 409);
            } finally {
                applicationRepo.updateReview = original;
            }
            const [users] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
            assert.equal(users.length, 0, "le compte doit etre annule avec la transaction");
        });

        describe("email deja associe a un compte", () => {
            let existing, applicationId;

            before(async () => {
                const { res, email } = await submitApplication();
                applicationId = res.body.id;
                // Compte cree apres le depot (ex. inscription directe).
                existing = await createUser({ roles: ["membre"], email });
            });

            it("renvoie 409 ACCOUNT_EXISTS sans option de rattachement", async () => {
                const accept = await rhHttp.post(`/api/admin/applications/${applicationId}/accept`, { roles: ["membre"] });
                assert.equal(accept.status, 409);
                assert.equal(accept.body.code, "ACCOUNT_EXISTS");
                assert.ok(accept.body.details.email, "l'email du compte existant est renvoye");
            });

            it("refuse le rattachement avec un role non attribuable (403)", async () => {
                const accept = await rhHttp.post(`/api/admin/applications/${applicationId}/accept`, {
                    roles: ["responsable_finance"], linkExisting: true,
                });
                assert.equal(accept.status, 403);
            });

            it("rattache la candidature au compte existant sans changer son mot de passe", async () => {
                const [[before]] = await db.query("SELECT password FROM users WHERE id = ?", [existing.id]);
                // L'admin peut attribuer secretaire_generale (pas la RH).
                const accept = await adminHttp.post(`/api/admin/applications/${applicationId}/accept`, {
                    roles: ["secretaire_generale"], linkExisting: true,
                });

                assert.equal(accept.status, 200);
                assert.equal(accept.body.linkedExisting, true);
                assert.equal(accept.body.tempPassword, undefined);
                assert.deepEqual(new Set(accept.body.user.roles), new Set(["membre", "secretaire_generale"]));
                assert.equal(accept.body.application.user_id, existing.id);

                const [[after]] = await db.query("SELECT password FROM users WHERE id = ?", [existing.id]);
                assert.equal(after.password, before.password);
                assert.ok(await bcrypt.compare(PASSWORD, after.password));
            });
        });
    });
});
