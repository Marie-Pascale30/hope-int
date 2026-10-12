const { db, request, app, resetDatabase, createUser, loginAs, insertEvent, lastLog, hoursFromNow } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { computeBadges, eventDurationHours, normalizeCertificateCode } = require("@hope/shared/volunteering");

const register = (eventId, userId) =>
    db.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [eventId, userId]);

describe("benevolat : presences, heures, attestations, groupes regionaux", () => {
    let orga, orgaHttp, rh, rhHttp, member, memberHttp, other, otherHttp, finance, financeHttp;

    before(async () => {
        await resetDatabase();
        orga = await createUser({ roles: ["organisatrice"] });
        rh = await createUser({ roles: ["responsable_rh"] });
        finance = await createUser({ roles: ["responsable_finance"] });
        member = await createUser({ roles: ["membre"], name: "Alice Bénévole", region: "Littoral" });
        other = await createUser({ roles: ["membre"], name: "Brice Autre", region: "Ouest" });
        [orgaHttp, rhHttp, memberHttp, otherHttp, financeHttp] = await Promise.all(
            [orga, rh, member, other, finance].map((user) => loginAs(user))
        );
        await db.query("UPDATE users SET skills = 'Premiers secours', availability = 'Week-ends' WHERE id = ?", [member.id]);
    });

    after(() => db.end());

    describe("referentiel partage", () => {
        it("calcule la duree par defaut et les badges", () => {
            assert.equal(eventDurationHours("2026-01-01T08:00:00Z", "2026-01-01T11:30:00Z"), 3.5);
            assert.equal(eventDurationHours("2026-01-01T08:00:00Z", null), 2);
            const badges = computeBadges({ hours: 12, events: 5, activities: 6, firstActivityAt: "2025-01-01" }, new Date("2026-02-01"));
            const earned = badges.filter((badge) => badge.earned).map((badge) => badge.key);
            assert.deepEqual(earned.sort(), ["events_5", "first_step", "hours_10", "one_year"]);
            assert.equal(badges.find((badge) => badge.key === "hours_50").progress, 24);
            assert.equal(normalizeCertificateCode("hope abcd-efgh-jkmn"), "HOPE-ABCD-EFGH-JKMN");
            assert.equal(normalizeCertificateCode("HOPE-ABCD"), null);
        });
    });

    describe("appel des participants", () => {
        let pastEvent, futureEvent;

        before(async () => {
            pastEvent = await insertEvent({ title: "Distribution", startAt: hoursFromNow(-30), endAt: hoursFromNow(-27) });
            futureEvent = await insertEvent({ title: "A venir", startAt: hoursFromNow(48) });
            await register(pastEvent, member.id);
            await register(pastEvent, other.id);
            await register(futureEvent, member.id);
        });

        it("refuse l'appel sans permission et avant le debut", async () => {
            const res = await financeHttp.agent
                .put(`/api/volunteering/admin/events/${pastEvent}/attendance`)
                .set("X-Requested-With", "XMLHttpRequest")
                .send({ entries: [{ userId: member.id, attendance: "present" }] });
            assert.equal(res.status, 403);
            const early = await orgaHttp.agent
                .put(`/api/volunteering/admin/events/${futureEvent}/attendance`)
                .set("X-Requested-With", "XMLHttpRequest")
                .send({ entries: [{ userId: member.id, attendance: "present" }] });
            assert.equal(early.status, 400);
        });

        it("enregistre presences et heures (duree de l'evenement par defaut)", async () => {
            const res = await orgaHttp.agent
                .put(`/api/volunteering/admin/events/${pastEvent}/attendance`)
                .set("X-Requested-With", "XMLHttpRequest")
                .send({ entries: [{ userId: member.id, attendance: "present" }, { userId: other.id, attendance: "absent" }] });
            assert.equal(res.status, 200);
            assert.equal(res.body.default_hours, 3);
            assert.equal(res.body.summary.present, 1);
            assert.equal(res.body.summary.absent, 1);
            assert.equal(res.body.summary.hours, 3);
            const log = await lastLog("event.attendance");
            assert.equal(log.meta.present, 1);
        });

        it("accepte des heures saisies et refuse un non-inscrit (RH benevolat)", async () => {
            const put = (entries) => rhHttp.agent
                .put(`/api/volunteering/admin/events/${pastEvent}/attendance`)
                .set("X-Requested-With", "XMLHttpRequest")
                .send({ entries });
            const ok = await put([{ userId: member.id, attendance: "present", hours: 4.5 }]);
            assert.equal(ok.status, 200);
            assert.equal(ok.body.registrations.find((row) => row.user_id === member.id).hours, 4.5);
            assert.equal((await put([{ userId: rh.id, attendance: "present" }])).status, 400);
            assert.equal((await put([{ userId: member.id, attendance: "maybe" }])).status, 422);
        });
    });

    describe("heures hors evenement", () => {
        it("reserve la saisie a MANAGE_VOLUNTEERS et valide les valeurs", async () => {
            const payload = { userId: member.id, mission: "Permanence", activityDate: "2026-01-10", hours: 6 };
            // La finance n'a pas MANAGE_VOLUNTEERS.
            assert.equal((await financeHttp.post("/api/volunteering/admin/hours", payload)).status, 403);
            assert.equal((await rhHttp.post("/api/volunteering/admin/hours", { ...payload, hours: 30 })).status, 422);
            assert.equal((await rhHttp.post("/api/volunteering/admin/hours", { ...payload, activityDate: "2999-01-01" })).status, 400);
            assert.equal((await rhHttp.post("/api/volunteering/admin/hours", { ...payload, userId: 999999 })).status, 404);

            const res = await rhHttp.post("/api/volunteering/admin/hours", payload);
            assert.equal(res.status, 201);
            assert.equal(res.body.hours, 6);
            const extra = await rhHttp.post("/api/volunteering/admin/hours", { ...payload, mission: "Erreur", hours: 1 });
            assert.equal((await rhHttp.delete(`/api/volunteering/admin/hours/${extra.body.id}`)).status, 200);
            assert.equal((await rhHttp.delete(`/api/volunteering/admin/hours/${extra.body.id}`)).status, 404);
        });

        it("montre au membre son compteur, son historique et ses badges", async () => {
            const res = await memberHttp.get("/api/volunteering/me");
            assert.equal(res.status, 200);
            assert.equal(res.body.totals.hours, 10.5);
            assert.equal(res.body.totals.events, 1);
            assert.equal(res.body.totals.missions, 1);
            assert.equal(res.body.history.length, 2);
            const earned = res.body.badges.filter((badge) => badge.earned).map((badge) => badge.key);
            assert.ok(earned.includes("first_step"));
            assert.ok(earned.includes("hours_10"));
            assert.equal((await request(app).get("/api/volunteering/me")).status, 401);
        });
    });

    describe("attestations", () => {
        let code;

        it("refuse une periode sans heures ou dans le futur", async () => {
            assert.equal((await otherHttp.post("/api/volunteering/me/certificates", {})).status, 400);
            assert.equal((await memberHttp.post("/api/volunteering/me/certificates", { to: "2999-01-01" })).status, 400);
            assert.equal((await memberHttp.post("/api/volunteering/me/certificates", { from: "2026-02-01", to: "2026-01-01" })).status, 400);
        });

        it("emet une attestation figee, idempotente, avec code unique", async () => {
            const res = await memberHttp.post("/api/volunteering/me/certificates", {});
            assert.equal(res.status, 201);
            assert.match(res.body.code, /^HOPE-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
            assert.equal(res.body.total_hours, 10.5);
            assert.equal(res.body.holder_name, "Alice Bénévole");
            assert.ok(res.body.badges.includes("hours_10"));
            code = res.body.code;
            const again = await memberHttp.post("/api/volunteering/me/certificates", {});
            assert.equal(again.body.code, code);
            const list = await memberHttp.get("/api/volunteering/me");
            assert.equal(list.body.certificates.length, 1);
        });

        it("fournit le PDF au seul titulaire", async () => {
            const pdf = await memberHttp.get(`/api/volunteering/me/certificates/${code}/pdf`).buffer(true);
            assert.equal(pdf.status, 200);
            assert.equal(pdf.headers["content-type"], "application/pdf");
            assert.equal(pdf.body.subarray(0, 4).toString(), "%PDF");
            assert.equal((await otherHttp.get(`/api/volunteering/me/certificates/${code}/pdf`)).status, 404);
        });

        it("verifie publiquement l'authenticite sans autre donnee personnelle", async () => {
            const res = await request(app).get(`/api/volunteering/certificates/${code.toLowerCase()}`);
            assert.equal(res.status, 200);
            assert.equal(res.body.valid, true);
            assert.equal(res.body.holder_name, "Alice Bénévole");
            assert.equal(res.body.total_hours, 10.5);
            assert.deepEqual(
                Object.keys(res.body).sort(),
                ["code", "holder_name", "issued_at", "period_end", "period_start", "total_hours", "valid"]
            );
            assert.equal((await request(app).get("/api/volunteering/certificates/HOPE-AAAA-AAAA-AAAA")).status, 404);
            const en = await request(app).get("/api/volunteering/certificates/HOPE-AAAA-AAAA-AAAA").set("Accept-Language", "en");
            assert.equal(en.body.error, "Certificate not found");
        });
    });

    describe("groupes regionaux", () => {
        it("liste les benevoles avec competences, heures et dernier engagement", async () => {
            assert.equal((await financeHttp.get("/api/volunteering/admin/volunteers")).status, 403);
            const res = await rhHttp.get("/api/volunteering/admin/volunteers?region=Littoral");
            assert.equal(res.status, 200);
            assert.deepEqual(res.body.map((row) => row.id), [member.id]);
            const row = res.body[0];
            assert.equal(row.skills, "Premiers secours");
            assert.equal(row.availability, "Week-ends");
            assert.equal(row.total_hours, 10.5);
            assert.ok(row.last_activity_at);

            const engaged = await rhHttp.get("/api/volunteering/admin/volunteers?engaged=1");
            assert.deepEqual(engaged.body.map((item) => item.id), [member.id]);
            const search = await rhHttp.get("/api/volunteering/admin/volunteers?q=secours");
            assert.deepEqual(search.body.map((item) => item.id), [member.id]);
        });

        it("exporte en CSV et journalise l'export", async () => {
            const res = await rhHttp.get("/api/volunteering/admin/volunteers/export?region=Littoral");
            assert.equal(res.status, 200);
            assert.match(res.headers["content-type"], /text\/csv/);
            assert.match(res.text, /Alice Bénévole/);
            assert.match(res.text, /10,5/);
            const log = await lastLog("volunteer.export");
            assert.equal(log.user_id, rh.id);
            assert.equal(log.meta.count, 1);
            assert.equal(log.meta.region, "Littoral");
        });

        it("donne la fiche d'un benevole avec son historique", async () => {
            const res = await rhHttp.get(`/api/volunteering/admin/volunteers/${member.id}`);
            assert.equal(res.status, 200);
            assert.equal(res.body.totals.hours, 10.5);
            assert.ok(res.body.history.some((item) => item.kind === "mission"));
        });
    });
});
