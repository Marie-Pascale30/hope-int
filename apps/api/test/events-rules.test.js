const { db, resetDatabase, createUser, loginAs, insertEvent, lastLog, hoursFromNow } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("evenements : dates, desinscription, suppression", () => {
    let orga, orgaHttp, member, memberHttp;

    before(async () => {
        await resetDatabase();
        orga = await createUser({ roles: ["organisatrice"] });
        member = await createUser({ roles: ["membre"] });
        orgaHttp = await loginAs(orga);
        memberHttp = await loginAs(member);
    });

    after(() => db.end());

    it("compare une fin seule a la date de debut enregistree", async () => {
        const id = await insertEvent({ startAt: hoursFromNow(48) });
        const res = await orgaHttp.patch(`/api/admin/events/${id}`, { end_at: hoursFromNow(24).toISOString() });
        assert.equal(res.status, 400);

        const ok = await orgaHttp.patch(`/api/admin/events/${id}`, { end_at: hoursFromNow(50).toISOString() });
        assert.equal(ok.status, 200);
    });

    it("compare un debut seul a la date de fin enregistree", async () => {
        const id = await insertEvent({ startAt: hoursFromNow(48), endAt: hoursFromNow(50) });
        const res = await orgaHttp.patch(`/api/admin/events/${id}`, { start_at: hoursFromNow(60).toISOString() });
        assert.equal(res.status, 400);
    });

    it("ne vide pas les champs absents d'une mise a jour partielle", async () => {
        const id = await insertEvent({ startAt: hoursFromNow(48), region: "Littoral" });
        const res = await orgaHttp.patch(`/api/admin/events/${id}`, { title: "Nouveau titre" });
        assert.equal(res.status, 200);
        assert.equal(res.body.region, "Littoral");
        assert.equal(res.body.title, "Nouveau titre");
    });

    it("permet la desinscription d'un evenement a venir", async () => {
        const id = await insertEvent({ startAt: hoursFromNow(48) });
        assert.equal((await memberHttp.post(`/api/events/${id}/registration`)).status, 201);
        assert.equal((await memberHttp.delete(`/api/events/${id}/registration`)).status, 200);
        assert.equal((await memberHttp.delete(`/api/events/${id}/registration`)).status, 404);
    });

    it("refuse la desinscription apres la fin de l'evenement", async () => {
        const id = await insertEvent({ startAt: hoursFromNow(-5), endAt: hoursFromNow(-3) });
        await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [id, member.id]);

        const res = await memberHttp.delete(`/api/events/${id}/registration`);
        assert.equal(res.status, 400);
        const [rows] = await db.query("SELECT id FROM event_registrations WHERE event_id = ?", [id]);
        assert.equal(rows.length, 1);
    });

    it("journalise la consultation des inscrits", async () => {
        const id = await insertEvent({ startAt: hoursFromNow(48) });
        await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [id, member.id]);

        const res = await orgaHttp.get(`/api/admin/events/${id}/registrations`);
        assert.equal(res.status, 200);
        const log = await lastLog("event.view_registrations");
        assert.equal(log.user_id, orga.id);
        assert.equal(log.meta.eventId, id);
        assert.equal(log.meta.count, 1);
    });

    it("previent les inscrits lors de la suppression d'un evenement a venir", async () => {
        const id = await insertEvent({ startAt: hoursFromNow(48) });
        await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [id, member.id]);

        const emailService = require("../services/emailService");
        const original = emailService.send;
        const sent = [];
        emailService.send = async (mail) => {
            sent.push(mail);
            return { sent: false, reason: "test" };
        };
        try {
            assert.equal((await orgaHttp.delete(`/api/admin/events/${id}`)).status, 200);
            await new Promise((resolve) => setTimeout(resolve, 20));
        } finally {
            emailService.send = original;
        }

        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, member.email);
        assert.match(sent[0].subject, /annulé/);
        const log = await lastLog("event.delete");
        assert.equal(log.meta.registrations, 1);
        assert.equal(log.meta.notified, 1);
    });
});
