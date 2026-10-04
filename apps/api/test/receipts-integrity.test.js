const { db, request, app, resetDatabase, createUser, createPayment, loginAs } = require("./helpers");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const paymentService = require("../services/paymentService");
const paymentRepo = require("../repositories/paymentRepository");
const receiptService = require("../services/receiptService");

const succeed = async (id) => paymentService._applyStatus(await paymentRepo.findById(id), "succeeded", "test");
const tick = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("recus de don", () => {
    before(() => resetDatabase());
    after(async () => {
        await tick();
        await db.end();
    });

    it("numerote sans doublon ni trou sous forte concurrence", async () => {
        const payments = [];
        for (let i = 0; i < 15; i += 1) payments.push(await createPayment());
        await Promise.all(payments.map((p) => succeed(p.id)));

        const [rows] = await db.query("SELECT receipt_number FROM payments WHERE receipt_number IS NOT NULL ORDER BY receipt_number");
        const year = receiptService.receiptYear(new Date());
        assert.deepEqual(
            rows.map((row) => row.receipt_number),
            payments.map((_p, i) => `HOPE-${year}-${String(i + 1).padStart(6, "0")}`)
        );
        const [[sequence]] = await db.query("SELECT last_number FROM receipt_sequences WHERE year = ?", [year]);
        assert.equal(sequence.last_number, 15);
    });

    it("l'annee du recu suit paid_at dans RECEIPT_TIMEZONE (Africa/Douala par defaut)", async () => {
        // 31/12/2025 23:30 UTC = 01/01/2026 00:30 a Douala
        assert.equal(receiptService.receiptYear(new Date("2025-12-31T23:30:00Z")), 2026);
        assert.equal(receiptService.formatDate(new Date("2025-12-31T23:30:00Z")), "01/01/2026");
        const { from, to } = receiptService.yearBounds(2026);
        assert.equal(from.toISOString(), "2025-12-31T23:00:00.000Z");
        assert.equal(to.toISOString(), "2026-12-31T23:00:00.000Z");
    });

    it("reprend la sequence depuis les numeros existants (migration rejouable)", async () => {
        await createPayment({ status: "succeeded", receipt_number: "HOPE-2031-000050", paid_at: new Date("2031-03-01T10:00:00Z") });
        await db.query("DELETE FROM receipt_sequences WHERE year = 2031");
        await require("../migrations/002_payments_integrity").up({ db });

        const pending = await createPayment({ paid_at: new Date("2031-06-01T10:00:00Z") });
        await succeed(pending.id);
        assert.equal((await paymentRepo.findById(pending.id)).receipt_number, "HOPE-2031-000051");
    });

    it("fige le recu a l'emission et prefere le nom saisi sur le don", async () => {
        const user = await createUser({ name: "Nom du compte" });
        const [project] = await db.query("INSERT INTO projects (title, description) VALUES ('École de Kribi', 'x')");
        const payment = await createPayment({
            user_id: user.id,
            donor_name: "Entreprise Saisie SARL",
            project_id: project.insertId,
            amount: 25,
        });
        await succeed(payment.id);

        await db.query("UPDATE projects SET title = 'Titre modifié' WHERE id = ?", [project.insertId]);
        await db.query("UPDATE users SET name = 'Autre nom' WHERE id = ?", [user.id]);
        await db.query("UPDATE payments SET amount = 99 WHERE id = ?", [payment.id]);

        const view = receiptService.receiptView(await paymentRepo.findById(payment.id));
        assert.equal(view.donorName, "Entreprise Saisie SARL");
        assert.equal(view.designation, "École de Kribi");
        assert.equal(view.amount, 25);
        assert.equal(view.method, "card");
        assert.equal(view.frequency, "once");

        const res = await request(app).get(`/api/payment/receipts/${payment.receipt_token}/pdf`);
        assert.equal(res.status, 200);
        assert.equal(res.headers["content-type"], "application/pdf");
        assert.equal(res.body.subarray(0, 4).toString(), "%PDF");
    });

    it("repli sur les donnees vivantes pour un ancien recu sans snapshot", async () => {
        const payment = await createPayment({ status: "succeeded", receipt_number: "HOPE-2020-000001", paid_at: new Date("2020-05-01T10:00:00Z") });
        const view = receiptService.receiptView(await paymentRepo.findById(payment.id));
        assert.equal(view.donorName, "Ada Donatrice");
        assert.equal(view.designation, "Fonds général de l'association");
    });

    it("recapitulatif annuel : PDF des dons confirmes du compte, authentification requise", async () => {
        const user = await createUser();
        const year = receiptService.receiptYear(new Date());
        for (const amount of [10, 15]) {
            const p = await createPayment({ user_id: user.id, amount, frequency: "monthly", subscription_id: "sub_annual" });
            await succeed(p.id);
        }
        await createPayment({ user_id: user.id, status: "refunded", amount: 500, paid_at: new Date() });

        assert.equal((await request(app).get(`/api/payment/receipts/annual/${year}/pdf`)).status, 401);
        const http = await loginAs(user);
        const res = await http.get(`/api/payment/receipts/annual/${year}/pdf`).buffer(true);
        assert.equal(res.status, 200);
        assert.equal(res.headers["content-type"], "application/pdf");
        assert.equal((await http.get(`/api/payment/receipts/annual/${year - 3}/pdf`)).status, 404);

        const { from, to } = receiptService.yearBounds(year);
        const rows = await paymentRepo.getSucceededByUserBetween(user.id, from, to);
        assert.equal(rows.length, 2);
    });
});
