const { db, resetDatabase, createUser, createPayment, loginAs } = require("./helpers");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

// Dons en verification (montant ou devise incoherents) : decision manuelle reservee a la finance.
describe("traitement des dons en verification", () => {
    let finance, rh;

    before(async () => {
        await resetDatabase();
        finance = await loginAs(await createUser({ roles: ["responsable_finance"] }));
        rh = await loginAs(await createUser({ roles: ["responsable_rh"] }));
    });

    after(() => db.end());

    const statusOf = async (id) => (await db.query("SELECT status, receipt_number FROM payments WHERE id = ?", [id]))[0][0];

    it("reserve la decision aux roles finance", async () => {
        const payment = await createPayment({ status: "review" });
        const res = await rh.post(`/api/admin/donations/${payment.id}/review`, { decision: "approve" });

        assert.equal(res.status, 403);
        assert.equal((await statusOf(payment.id)).status, "review");
    });

    it("valide un don et emet son recu", async () => {
        const payment = await createPayment({ status: "review" });
        const res = await finance.post(`/api/admin/donations/${payment.id}/review`, { decision: "approve", note: "Montant verifie" });

        assert.equal(res.status, 200);
        const row = await statusOf(payment.id);
        assert.equal(row.status, "succeeded");
        assert.match(row.receipt_number, /^HOPE-\d{4}-\d+$/);
        const [[log]] = await db.query("SELECT meta FROM activity_logs WHERE action = 'payment.review_approved' ORDER BY id DESC LIMIT 1");
        assert.equal(log.meta.note, "Montant verifie");
    });

    it("rejette un don sans emettre de recu", async () => {
        const payment = await createPayment({ status: "review" });
        const res = await finance.post(`/api/admin/donations/${payment.id}/review`, { decision: "reject" });

        assert.equal(res.status, 200);
        const row = await statusOf(payment.id);
        assert.equal(row.status, "canceled");
        assert.equal(row.receipt_number, null);
    });

    it("refuse de traiter un don qui n'est pas en verification", async () => {
        const payment = await createPayment({ status: "pending" });
        const res = await finance.post(`/api/admin/donations/${payment.id}/review`, { decision: "approve" });

        assert.equal(res.status, 400);
        assert.equal((await statusOf(payment.id)).status, "pending");
    });

    it("valide la decision demandee", async () => {
        const payment = await createPayment({ status: "review" });
        const res = await finance.post(`/api/admin/donations/${payment.id}/review`, { decision: "peut-etre" });
        assert.equal(res.status, 422);
    });

    it("deduit les remboursements partiels des statistiques", async () => {
        const statsRepo = require("../repositories/statsRepository");
        const before = (await statsRepo.getDashboard()).totalDonations;
        await createPayment({ status: "succeeded", amount: 100, refunded_amount: 30 });

        assert.equal((await statsRepo.getDashboard()).totalDonations, before + 70);
    });

    it("ne renvoie un recu que pour un don confirme", async () => {
        const pending = await createPayment({ status: "pending" });
        assert.equal((await finance.post(`/api/admin/donations/${pending.id}/resend-receipt`)).status, 400);

        const payment = await createPayment({ status: "review" });
        await finance.post(`/api/admin/donations/${payment.id}/review`, { decision: "approve" });
        assert.equal((await finance.post(`/api/admin/donations/${payment.id}/resend-receipt`)).status, 200);
    });
});
