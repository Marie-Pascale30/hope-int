// Budget previsionnel, depenses (justificatifs prives), portee regionale et export "bailleurs".
const os = require("os");
const fs = require("fs");
const path = require("path");

// Justificatifs ecrits dans un dossier temporaire (jamais dans le depot).
const PRIVATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hope-private-"));
process.env.PRIVATE_UPLOADS_DIR = PRIVATE_DIR;
process.env.TRANSPARENCY_CACHE_MS = "0";

const {
    db, resetDatabase, createUser, loginAs, insertProject, insertPayment, lastLog, PNG_BYTES,
} = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

// Formulaire multipart avec justificatif (champ "receipt") en conservant la session.
function sendExpense(http, method, url, fields, file) {
    let req = http.agent[method](url).set("X-Requested-With", "XMLHttpRequest");
    for (const [key, value] of Object.entries(fields)) req = req.field(key, String(value));
    if (file) req = req.attach("receipt", file.buffer, { filename: file.filename, contentType: file.contentType });
    return req;
}

const receiptFiles = () => fs.readdirSync(path.join(PRIVATE_DIR, "expenses"), { withFileTypes: true }).filter((entry) => entry.isFile());

describe("transparence : budget et depenses", () => {
    let finance, financeHttp, member, regional, regionalHttp, projectLittoral, projectNord;

    before(async () => {
        await resetDatabase();
        finance = await createUser({ roles: ["responsable_finance"] });
        financeHttp = await loginAs(finance);
        member = await createUser({ roles: ["membre"] });
        // Finance cumulee avec la direction regionale : portee limitee au Littoral.
        regional = await createUser({ roles: ["directrice_regionale", "responsable_finance"], region: "Littoral" });
        regionalHttp = await loginAs(regional);
        projectLittoral = await insertProject({ title: "Coopérative de Douala", region: "Littoral", beneficiaries: 120, trainees: 40, credits_granted: 25 });
        projectNord = await insertProject({ title: "Puits de Garoua", region: "Nord" });
    });

    after(async () => {
        await db.end();
        fs.rmSync(PRIVATE_DIR, { recursive: true, force: true });
    });

    it("reserve le budget a la finance", async () => {
        const memberHttp = await loginAs(member);
        const res = await memberHttp.get("/api/transparency/admin/budget/projects");
        assert.equal(res.status, 403);
        const anonymous = await require("supertest")(require("../app")).get("/api/transparency/admin/budget/projects");
        assert.equal(anonymous.status, 401);
    });

    it("saisit le budget previsionnel et valide les montants", async () => {
        const url = `/api/transparency/admin/budget/projects/${projectLittoral}/lines`;
        assert.equal((await financeHttp.post(url, { category: "training", amount: 1000, currency: "eur" })).status, 201);
        assert.equal((await financeHttp.post(url, { category: "microcredit", amount: 655957, currency: "xaf" })).status, 201);
        assert.equal((await financeHttp.post(url, { category: "inconnue", amount: 10, currency: "eur" })).status, 422);
        assert.equal((await financeHttp.post(url, { category: "training", amount: -5, currency: "eur" })).status, 422);
        assert.equal((await financeHttp.post("/api/transparency/admin/budget/projects/99999/lines", { category: "training", amount: 5, currency: "eur" })).status, 404);
    });

    it("enregistre une depense avec justificatif PDF verifie et calcule les ecarts", async () => {
        const res = await sendExpense(financeHttp, "post", "/api/transparency/admin/expenses", {
            projectId: projectLittoral, category: "training", amount: 1200, currency: "eur", spentOn: "2025-03-10", description: "Formation en gestion",
        }, { buffer: PDF_BYTES, filename: "facture.pdf", contentType: "application/pdf" });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.has_receipt, true);
        assert.equal(res.body.receipt_path, undefined, "le chemin disque ne sort jamais de l'API");
        assert.equal(receiptFiles().length, 1);

        const budget = await financeHttp.get(`/api/transparency/admin/budget/projects/${projectLittoral}`);
        assert.equal(budget.status, 200);
        const training = budget.body.byCategory.find((row) => row.category === "training");
        assert.deepEqual(
            { planned: training.plannedEur, spent: training.spentEur, variance: training.varianceEur, rate: training.rate },
            { planned: 1000, spent: 1200, variance: 200, rate: 120 }
        );
        const microcredit = budget.body.byCategory.find((row) => row.category === "microcredit");
        assert.equal(microcredit.plannedEur, 1000, "XAF converti a la parite fixe");
        assert.equal(budget.body.totals.plannedEur, 2000);

        const download = await financeHttp.get(`/api/transparency/admin/expenses/${res.body.id}/receipt`);
        assert.equal(download.status, 200);
        assert.match(download.headers["content-type"], /application\/pdf/);
        assert.match(download.headers["cache-control"], /no-store/);
        assert.ok((await lastLog("budget.receipt_download")));
    });

    it("refuse un justificatif dont la signature n'est ni PDF ni image, sans rien ecrire", async () => {
        const before = receiptFiles().length;
        const res = await sendExpense(financeHttp, "post", "/api/transparency/admin/expenses", {
            projectId: projectLittoral, category: "equipment", amount: 50, currency: "eur", spentOn: "2025-04-01", description: "Faux PDF",
        }, { buffer: Buffer.from("<script>alert(1)</script>"), filename: "facture.pdf", contentType: "application/pdf" });
        assert.equal(res.status, 400);
        assert.equal(receiptFiles().length, before);
    });

    it("supprime le fichier si la validation echoue apres l'upload", async () => {
        const before = receiptFiles().length;
        const res = await sendExpense(financeHttp, "post", "/api/transparency/admin/expenses", {
            projectId: projectLittoral, category: "equipment", amount: 50, currency: "eur", spentOn: "2999-01-01", description: "Date future",
        }, { buffer: PNG_BYTES, filename: "ticket.png", contentType: "image/png" });
        assert.equal(res.status, 422);
        // Suppression asynchrone apres l'envoi de la reponse.
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(receiptFiles().length, before);
    });

    it("remplace puis retire un justificatif", async () => {
        const created = await sendExpense(financeHttp, "post", "/api/transparency/admin/expenses", {
            projectId: projectLittoral, category: "transport", amount: 30000, currency: "xaf", spentOn: "2025-05-02", description: "Moto-taxi",
        }, { buffer: PNG_BYTES, filename: "ticket.png", contentType: "image/png" });
        assert.equal(created.status, 201);
        const count = receiptFiles().length;
        const fields = { projectId: projectLittoral, category: "transport", amount: 30000, currency: "xaf", spentOn: "2025-05-02", description: "Moto-taxi (corrigé)" };
        const replaced = await sendExpense(financeHttp, "patch", `/api/transparency/admin/expenses/${created.body.id}`, fields,
            { buffer: PDF_BYTES, filename: "recu.pdf", contentType: "application/pdf" });
        assert.equal(replaced.status, 200);
        assert.equal(receiptFiles().length, count, "l'ancien justificatif est supprime");
        const removed = await sendExpense(financeHttp, "patch", `/api/transparency/admin/expenses/${created.body.id}`, { ...fields, removeReceipt: "1" });
        assert.equal(removed.body.has_receipt, false);
        assert.equal(receiptFiles().length, count - 1);
        assert.equal((await financeHttp.get(`/api/transparency/admin/expenses/${created.body.id}/receipt`)).status, 404);
    });

    it("limite une directrice regionale a sa region et lui refuse les frais generaux", async () => {
        const list = await regionalHttp.get("/api/transparency/admin/budget/projects");
        assert.equal(list.status, 200);
        assert.deepEqual(list.body.projects.map((project) => project.id), [projectLittoral]);
        assert.equal(list.body.generalCostsEur, null);

        assert.equal((await regionalHttp.get(`/api/transparency/admin/budget/projects/${projectNord}`)).status, 403);
        assert.equal((await regionalHttp.post(`/api/transparency/admin/budget/projects/${projectNord}/lines`, { category: "training", amount: 5, currency: "eur" })).status, 403);

        const general = await sendExpense(regionalHttp, "post", "/api/transparency/admin/expenses", {
            category: "administration", amount: 10, currency: "eur", spentOn: "2025-01-05", description: "Loyer du bureau",
        });
        assert.equal(general.status, 403);

        const nord = await sendExpense(financeHttp, "post", "/api/transparency/admin/expenses", {
            projectId: projectNord, category: "equipment", amount: 300, currency: "eur", spentOn: "2025-02-01", description: "Pompe",
        });
        assert.equal(nord.status, 201);
        assert.equal((await regionalHttp.delete(`/api/transparency/admin/expenses/${nord.body.id}`)).status, 403);
        const expenses = await regionalHttp.get("/api/transparency/admin/expenses");
        assert.ok(expenses.body.items.every((item) => item.project_region === "Littoral"));
    });

    it("exporte le rapport bailleurs (indicateurs, recettes nettes, depenses) et le journalise", async () => {
        const paymentId = await insertPayment({ amount: 100, projectId: projectLittoral, email: "donatrice@test.hope.org", paidAt: new Date("2025-06-15T10:00:00Z") });
        await db.query("UPDATE payments SET refunded_amount = 20 WHERE id = ?", [paymentId]);
        await insertPayment({ amount: 50, projectId: projectLittoral, paidAt: new Date("2024-06-15T10:00:00Z") });

        const res = await financeHttp.get(`/api/transparency/admin/budget/projects/${projectLittoral}/export?from=2025-01-01&to=2025-12-31`);
        assert.equal(res.status, 200);
        assert.match(res.headers["content-type"], /text\/csv/);
        assert.match(res.headers["content-disposition"], /rapport-bailleurs-projet-/);
        const csv = res.text;
        assert.ok(csv.startsWith("﻿"));
        assert.match(csv, /Bénéficiaires \(beneficiaries\);120/);
        assert.match(csv, /Personnes formées \(trainees\);40/);
        assert.match(csv, /Microcrédits accordés \(credits_granted\);25/);
        assert.match(csv, /\r\nTotal;80,00;1\r\n/, "recettes de la periode, nettes du remboursement partiel");
        assert.match(csv, /Formations;1000,00;1200,00;200,00;120/);
        assert.doesNotMatch(csv, /donatrice@test/);

        const log = await lastLog("transparency.export_donor_report");
        assert.equal(log.meta.projectId, projectLittoral);
        assert.equal(log.user_id, finance.id);

        assert.equal((await financeHttp.get(`/api/transparency/admin/budget/projects/${projectLittoral}/export?from=2025-12-31&to=2025-01-01`)).status, 400);
        assert.equal((await regionalHttp.get(`/api/transparency/admin/budget/projects/${projectNord}/export`)).status, 403);
    });

    it("supprime une ligne de budget et une depense (avec son justificatif)", async () => {
        const budget = await financeHttp.get(`/api/transparency/admin/budget/projects/${projectLittoral}`);
        const line = budget.body.lines[0];
        assert.equal((await financeHttp.delete(`/api/transparency/admin/budget/lines/${line.id}`)).status, 200);
        assert.equal((await financeHttp.delete(`/api/transparency/admin/budget/lines/${line.id}`)).status, 404);

        const withReceipt = budget.body.expenses.find((expense) => expense.has_receipt);
        const count = receiptFiles().length;
        assert.equal((await financeHttp.delete(`/api/transparency/admin/expenses/${withReceipt.id}`)).status, 200);
        assert.equal(receiptFiles().length, count - 1);
    });
});
