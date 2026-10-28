const { db, resetDatabase, createUser, loginAs, insertEvent, lastLog, hoursFromNow } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const emailService = require("../services/emailService");
const preferences = require("../services/preferences");
const reminders = require("../services/volunteerReminders");

// Capture des emails envoyes pendant fn (envois non bloquants : courte attente).
async function captureEmails(fn) {
    const original = emailService.send;
    const sent = [];
    emailService.send = async (mail) => {
        sent.push(mail);
        return { sent: false, reason: "test" };
    };
    try {
        await fn();
        await new Promise((resolve) => setTimeout(resolve, 30));
    } finally {
        emailService.send = original;
    }
    return sent;
}

async function setCapacity(id, capacity) {
    await db.query("UPDATE events SET capacity = ? WHERE id = ?", [capacity, id]);
}

describe("evenements : liste d'attente, promotion, rappels", () => {
    let orgaHttp, members, https;

    before(async () => {
        await resetDatabase();
        orgaHttp = await loginAs(await createUser({ roles: ["organisatrice"] }));
        members = [];
        for (let i = 0; i < 5; i += 1) members.push(await createUser({ roles: ["invite"], name: `Invite ${i}` }));
        https = await Promise.all(members.map((member) => loginAs(member)));
    });

    after(() => db.end());

    describe("liste d'attente", () => {
        let eventId;

        before(async () => {
            eventId = await insertEvent({ title: "Atelier", startAt: hoursFromNow(72) });
            await setCapacity(eventId, 1);
        });

        it("signale un evenement complet et propose la liste d'attente", async () => {
            assert.equal((await https[0].post(`/api/events/${eventId}/registration`)).status, 201);
            const full = await https[1].post(`/api/events/${eventId}/registration`);
            assert.equal(full.status, 409);
            assert.equal(full.body.code, "EVENT_FULL");
        });

        it("inscrit en attente avec le rang et refuse les doublons", async () => {
            const first = await https[1].post(`/api/volunteering/events/${eventId}/waitlist`);
            assert.equal(first.status, 201);
            assert.deepEqual(first.body, { status: "waitlisted", position: 1 });
            const second = await https[2].post(`/api/volunteering/events/${eventId}/waitlist`);
            assert.equal(second.body.position, 2);
            assert.equal((await https[2].post(`/api/volunteering/events/${eventId}/waitlist`)).status, 409);
            assert.equal((await https[0].post(`/api/volunteering/events/${eventId}/waitlist`)).status, 409);

            const detail = await https[2].get(`/api/events/${eventId}`);
            assert.equal(detail.body.my_status, "waitlisted");
            assert.equal(detail.body.waitlist_position, 2);
            assert.equal(detail.body.waitlist_count, 2);
            assert.equal(detail.body.is_registered, false);
            const mine = await https[2].get("/api/events/mine");
            assert.equal(mine.body[0].my_status, "waitlisted");
        });

        it("permet de quitter la liste d'attente", async () => {
            await https[3].post(`/api/volunteering/events/${eventId}/waitlist`);
            assert.equal((await https[3].delete(`/api/volunteering/events/${eventId}/waitlist`)).status, 200);
            assert.equal((await https[3].delete(`/api/volunteering/events/${eventId}/waitlist`)).status, 404);
        });

        it("promeut le premier en attente a la liberation d'une place, avec email", async () => {
            const sent = await captureEmails(async () => {
                assert.equal((await https[0].delete(`/api/events/${eventId}/registration`)).status, 200);
            });
            assert.equal(sent.length, 1);
            assert.equal(sent[0].to, members[1].email);
            assert.match(sent[0].subject, /place s'est libérée/);
            const detail = await https[1].get(`/api/events/${eventId}`);
            assert.equal(detail.body.my_status, "registered");
            assert.equal(detail.body.is_registered, true);
            const next = await https[2].get(`/api/events/${eventId}`);
            assert.equal(next.body.waitlist_position, 1);
            const log = await lastLog("event.waitlist_promote");
            assert.deepEqual(log.meta.users, [members[1].id]);
        });

        it("promeut la liste d'attente quand la capacite augmente", async () => {
            const res = await orgaHttp.patch(`/api/admin/events/${eventId}`, { capacity: "3" });
            assert.equal(res.status, 200);
            const [rows] = await db.query("SELECT user_id FROM event_registrations WHERE event_id = ? ORDER BY user_id", [eventId]);
            assert.deepEqual(rows.map((row) => row.user_id), [members[1].id, members[2].id]);
            assert.equal(res.body.waitlist_count, 0);
        });

        it("inscrit directement s'il reste une place", async () => {
            const res = await https[4].post(`/api/volunteering/events/${eventId}/waitlist`);
            assert.deepEqual(res.body, { status: "registered", position: null });
        });

        it("serialise les demandes concurrentes sans depasser la capacite", async () => {
            const busy = await insertEvent({ title: "Course", startAt: hoursFromNow(72) });
            await setCapacity(busy, 2);
            const results = await Promise.all(https.map((http) => http.post(`/api/volunteering/events/${busy}/waitlist`)));
            assert.ok(results.every((res) => res.status === 201));
            const registered = results.filter((res) => res.body.status === "registered").length;
            const positions = results.filter((res) => res.body.status === "waitlisted").map((res) => res.body.position).sort();
            assert.equal(registered, 2);
            assert.deepEqual(positions, [1, 2, 3]);

            // Deux desinscriptions simultanees : deux promotions, jamais plus que la capacite.
            const leaving = results
                .map((res, index) => ({ res, index }))
                .filter(({ res }) => res.body.status === "registered")
                .map(({ index }) => https[index]);
            await captureEmails(() => Promise.all(leaving.map((http) => http.delete(`/api/events/${busy}/registration`))));
            const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ?", [busy]);
            const [[{ waiting }]] = await db.query("SELECT COUNT(*) AS waiting FROM event_waitlist WHERE event_id = ?", [busy]);
            assert.equal(Number(total), 2);
            assert.equal(Number(waiting), 1);
        });

        it("refuse la liste d'attente d'un evenement commence ou inexistant", async () => {
            const started = await insertEvent({ startAt: hoursFromNow(-1) });
            assert.equal((await https[0].post(`/api/volunteering/events/${started}/waitlist`)).status, 400);
            assert.equal((await https[0].post("/api/volunteering/events/999999/waitlist")).status, 404);
        });
    });

    describe("rappels de la veille", () => {
        it("envoie le rappel une seule fois et respecte le consentement", async () => {
            const soon = await insertEvent({ title: "Collecte", startAt: hoursFromNow(20) });
            const later = await insertEvent({ title: "Plus tard", startAt: hoursFromNow(80) });
            for (const member of members.slice(0, 3)) {
                await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [soon, member.id]);
                await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)", [later, member.id]);
            }
            const originalCan = preferences.canContact;
            const originalFooter = preferences.unsubscribeFooter;
            preferences.canContact = async (email, topic) => topic === "event_reminders" && email !== members[2].email;
            preferences.unsubscribeFooter = async () => "Se désabonner : https://exemple.test/u";
            let summary;
            try {
                const sent = await captureEmails(async () => {
                    summary = await reminders.sendDueReminders();
                });
                const forSoon = sent.filter((mail) => mail.subject.includes("Collecte"));
                assert.equal(forSoon.length, 2);
                assert.match(forSoon[0].text, /Se désabonner/);
                assert.ok(!sent.some((mail) => mail.subject.includes("Plus tard")));
                assert.ok(!sent.some((mail) => mail.to === members[2].email));
                assert.ok(summary.skipped >= 1);

                const again = await captureEmails(async () => {
                    await reminders.sendDueReminders();
                });
                assert.equal(again.filter((mail) => mail.subject.includes("Collecte")).length, 0);
            } finally {
                preferences.canContact = originalCan;
                preferences.unsubscribeFooter = originalFooter;
            }
            const log = await lastLog("event.reminder");
            assert.ok(log);
        });

        it("renvoie le rappel si la date de debut change", async () => {
            const id = await insertEvent({ title: "Deplace", startAt: hoursFromNow(10) });
            await db.query("UPDATE events SET reminder_sent_at = NOW() WHERE id = ?", [id]);
            await orgaHttp.patch(`/api/admin/events/${id}`, { start_at: hoursFromNow(12).toISOString() });
            const [[row]] = await db.query("SELECT reminder_sent_at FROM events WHERE id = ?", [id]);
            assert.equal(row.reminder_sent_at, null);
        });
    });

    describe("suppression", () => {
        it("previent aussi les personnes en liste d'attente", async () => {
            const id = await insertEvent({ title: "Annule", startAt: hoursFromNow(48) });
            await setCapacity(id, 1);
            await https[0].post(`/api/events/${id}/registration`);
            await https[1].post(`/api/volunteering/events/${id}/waitlist`);
            const sent = await captureEmails(async () => {
                assert.equal((await orgaHttp.delete(`/api/admin/events/${id}`)).status, 200);
            });
            assert.deepEqual(sent.map((mail) => mail.to).sort(), [members[0].email, members[1].email].sort());
            const log = await lastLog("event.delete");
            assert.equal(log.meta.waitlist, 1);
        });
    });
});
