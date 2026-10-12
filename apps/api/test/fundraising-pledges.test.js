const { db, resetDatabase, createUser, loginAs, client, createPayment, mockMethods } = require("./helpers");
const { insertProject } = require("./fixtures");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const emailService = require("../services/emailService");
const preferences = require("../services/preferences");
const notchpayProvider = require("../services/payments/notchpayProvider");
const pledgeService = require("../services/donationPledgeService");
const paymentRepo = require("../repositories/paymentRepository");

let restore = [];
const mock = (target, methods) => restore.push(mockMethods(target, methods));
let sent = [];
const tick = () => new Promise((resolve) => setTimeout(resolve, 80));

// Date du mois suivant (jour 28 a midi UTC), pour simuler le passage du worker.
function nextMonth(day = 28) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day, 12));
}

describe("engagements de don mensuel Mobile Money", () => {
    let member;
    let memberUser;
    let other;
    let projectId;

    before(async () => {
        await resetDatabase();
        memberUser = await createUser();
        member = await loginAs(memberUser);
        other = await loginAs(await createUser());
        projectId = await insertProject({ title: "Microcrédit Douala" });
    });
    after(async () => {
        await tick();
        await db.end();
    });
    afterEach(() => {
        restore.reverse().forEach((fn) => fn());
        restore = [];
        sent = [];
    });
    const captureEmails = () => mock(emailService, { send: async (message) => { sent.push(message); return { sent: true }; } });

    it("valide montant et jour du mois", async () => {
        assert.equal((await member.post("/api/fundraising/pledges", { amount: 5000, dayOfMonth: 31 })).status, 422);
        assert.equal((await member.post("/api/fundraising/pledges", { amount: 100, dayOfMonth: 5 })).status, 400);
    });

    it("cree un engagement (membre) avec email de confirmation et lien de paiement pre-rempli", async () => {
        captureEmails();
        const res = await member.post("/api/fundraising/pledges", { amount: 5000, dayOfMonth: 5, projectId });
        assert.equal(res.status, 201);
        const { pledge } = res.body;
        assert.equal(pledge.status, "active");
        assert.match(pledge.pay_url, /\/don\?montant=5000&devise=xaf&moyen=mobile_money&engagement=[a-f0-9]{24}&ref=engagement&projet=\d+/);
        assert.match(pledge.whatsapp_url, /^https:\/\/wa\.me\/\?text=/);
        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, memberUser.email);

        const mine = await member.get("/api/fundraising/pledges/mine");
        assert.equal(mine.body.length, 1);
        assert.equal((await other.get("/api/fundraising/pledges/mine")).body.length, 0);
        // Un autre membre ne peut pas le modifier.
        assert.equal((await other.patch(`/api/fundraising/pledges/${pledge.id}`, { status: "paused" })).status, 404);
    });

    it("rattache un don fait avec le lien et suit la regularite", async () => {
        const [mine] = (await member.get("/api/fundraising/pledges/mine")).body;
        const payRef = new URL(mine.pay_url).searchParams.get("engagement");
        mock(notchpayProvider, {
            isEnabled: () => true,
            createPaymentLink: async () => ({ transactionId: `trx.pledge.${Date.now()}`, redirectUrl: "https://pay.example/x" }),
        });
        const res = await member.post("/api/payment/donations", { amount: 5000, provider: "mobile_money", phone: "+237690000000", pledgeRef: payRef, source: "engagement" });
        assert.equal(res.status, 201);
        const payment = await paymentRepo.findById(res.body.paymentId);
        assert.equal(payment.pledge_id, mine.id);
        await db.query("UPDATE payments SET status = 'succeeded', paid_at = NOW() WHERE id = ?", [payment.id]);

        const [after] = (await member.get("/api/fundraising/pledges/mine")).body;
        assert.equal(after.regularity.paid, 1);
        assert.equal(after.regularity.missed, 0);
    });

    it("calcule les echeances payees et manquees", () => {
        const now = new Date(Date.UTC(2026, 5, 15));
        const result = pledgeService.regularity(
            {},
            [{ period: "2026-03" }, { period: "2026-04" }, { period: "2026-05" }, { period: "2026-06" }],
            [{ paid_at: new Date(Date.UTC(2026, 2, 10)), amount: 5000 }, { paid_at: new Date(Date.UTC(2026, 4, 10)), amount: 5000 }],
            now
        );
        assert.equal(result.paid, 2);
        assert.equal(result.missed, 1);
        assert.equal(result.rate, 67);
        assert.equal(result.periods.at(-1).status, "due");
    });

    it("envoie le rappel mensuel une seule fois, respecte le consentement et la suspension", async () => {
        captureEmails();
        const date = nextMonth();
        let summary = await pledgeService.runReminders({ now: date });
        assert.equal(summary.sent, 1);
        assert.match(sent[0].text, /Payer par Mobile Money \(lien déjà rempli\) : .*engagement=/);
        assert.match(sent[0].text, /wa\.me/);
        summary = await pledgeService.runReminders({ now: date });
        assert.equal(summary.sent, 0, "un seul rappel par mois");

        // Mois suivant : engagement suspendu -> aucun rappel.
        const [mine] = (await member.get("/api/fundraising/pledges/mine")).body;
        assert.equal((await member.patch(`/api/fundraising/pledges/${mine.id}`, { status: "paused" })).body.status, "paused");
        const later = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 28, 12));
        assert.equal((await pledgeService.runReminders({ now: later })).sent, 0);

        await member.patch(`/api/fundraising/pledges/${mine.id}`, { status: "active" });
        mock(preferences, { canContact: async () => false });
        assert.equal((await pledgeService.runReminders({ now: later })).sent, 0, "sans consentement");
    });

    it("gestion sans compte par jeton : lecture, modification, arret definitif", async () => {
        captureEmails();
        const res = await client().post("/api/fundraising/pledges", { amount: 2000, dayOfMonth: 10, donorName: "Sans Compte", donorEmail: "sanscompte@test.hope.org" });
        assert.equal(res.status, 201);
        const token = res.body.manageToken;
        assert.match(token, /^[a-f0-9]{48}$/);
        assert.match(sent[0].text, new RegExp(`/collecte/engagement/${token}`));

        const read = await client().get(`/api/fundraising/pledges/token/${token}`);
        assert.equal(read.status, 200);
        assert.equal(read.body.amount, 2000);
        assert.equal(read.body.donor_email, undefined);

        const updated = await client().patch(`/api/fundraising/pledges/token/${token}`, { amount: 3000, dayOfMonth: 12 });
        assert.equal(updated.body.amount, 3000);
        assert.equal(updated.body.day_of_month, 12);

        const stopped = await client().patch(`/api/fundraising/pledges/token/${token}`, { status: "stopped" });
        assert.equal(stopped.body.status, "stopped");
        assert.equal(stopped.body.pay_url, null);
        assert.equal((await client().patch(`/api/fundraising/pledges/token/${token}`, { status: "active" })).status, 400);
        assert.equal((await client().get(`/api/fundraising/pledges/token/${"0".repeat(48)}`)).status, 404);
    });

    it("liste d'administration reservee aux droits dons", async () => {
        assert.equal((await member.get("/api/fundraising/admin/pledges")).status, 403);
        const finance = await loginAs(await createUser({ roles: ["responsable_finance"] }));
        const res = await finance.get("/api/fundraising/admin/pledges");
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 2);
        assert.ok(res.body[0].donor_email);
    });

    it("n'attache pas un don a une reference inconnue", async () => {
        const payment = await createPayment({});
        assert.equal((await paymentRepo.findById(payment.id)).pledge_id, null);
    });
});
