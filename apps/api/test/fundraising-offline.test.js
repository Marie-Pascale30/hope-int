const { db, resetDatabase, createUser, loginAs } = require("./helpers");
const { PNG_BYTES, insertProject, lastLog } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const paymentRepo = require("../repositories/paymentRepository");
const paymentService = require("../services/paymentService");
const { detectProofType } = require("../services/donationProofs");

const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const tick = () => new Promise((resolve) => setTimeout(resolve, 100));

function submit(http, fields, file) {
    let req = http.agent.post("/api/fundraising/admin/offline").set("X-Requested-With", "XMLHttpRequest");
    for (const [key, value] of Object.entries(fields)) req = req.field(key, String(value));
    if (file) req = req.attach("proof", file.buffer, { filename: file.filename, contentType: file.contentType });
    return req;
}

const today = () => new Date().toISOString().slice(0, 10);

describe("dons hors ligne (finance, validation a 4 yeux)", () => {
    let author;
    let checker;
    let member;
    let projectId;

    before(async () => {
        await resetDatabase();
        author = await loginAs(await createUser({ roles: ["responsable_finance"] }));
        checker = await loginAs(await createUser({ roles: ["responsable_finance"] }));
        member = await loginAs(await createUser());
        projectId = await insertProject({ title: "Cantine scolaire" });
    });
    after(async () => {
        await tick();
        await db.end();
    });

    it("reconnait PDF et images par leur signature, refuse le reste", () => {
        assert.equal(detectProofType(PDF_BYTES).mime, "application/pdf");
        assert.equal(detectProofType(PNG_BYTES).mime, "image/png");
        assert.equal(detectProofType(Buffer.from("<html><script>")), null);
        assert.equal(detectProofType(Buffer.from("GIF89a....")), null);
    });

    it("refuse la saisie a un membre sans droit finance", async () => {
        const res = await submit(member, { kind: "cash", amount: 10000, currency: "xaf", donorName: "Paul", receivedOn: today() });
        assert.equal(res.status, 403);
    });

    it("refuse un justificatif deguise (signature non reconnue)", async () => {
        const res = await submit(author, { kind: "cash", amount: 10000, currency: "xaf", donorName: "Paul", receivedOn: today() }, {
            buffer: Buffer.from("MZ executable"), filename: "recu.pdf", contentType: "application/pdf",
        });
        assert.equal(res.status, 400);
        const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM donation_offline");
        assert.equal(count, 0);
    });

    it("exige une description pour un don en nature", async () => {
        const res = await submit(author, { kind: "in_kind", amount: 300, currency: "eur", donorName: "Entreprise X", receivedOn: today() });
        assert.equal(res.status, 400);
    });

    it("saisie en attente, refus de l'auteur, validation par une seconde personne avec recu numerote", async () => {
        const res = await submit(author, {
            kind: "check", amount: 150, currency: "eur", donorName: "Claire Martin", donorEmail: "claire@test.hope.org",
            projectId, receivedOn: today(), reference: "0012345",
        }, { buffer: PDF_BYTES, filename: "cheque scanné.pdf", contentType: "application/pdf" });
        assert.equal(res.status, 201);
        assert.equal(res.body.status, "pending_validation");
        assert.equal(res.body.has_proof, true);
        assert.equal(res.body.proof_data, undefined, "le justificatif n'est jamais renvoye dans la liste");
        const id = res.body.id;

        const proof = await checker.get(`/api/fundraising/admin/offline/${id}/proof`);
        assert.equal(proof.status, 200);
        assert.equal(proof.headers["content-type"], "application/pdf");
        assert.match(proof.headers["content-disposition"], /attachment; filename="cheque-scanne\.pdf"/);
        assert.equal((await member.get(`/api/fundraising/admin/offline/${id}/proof`)).status, 403);

        const selfValidation = await author.post(`/api/fundraising/admin/offline/${id}/validate`);
        assert.equal(selfValidation.status, 403);

        const validated = await checker.post(`/api/fundraising/admin/offline/${id}/validate`);
        assert.equal(validated.status, 200);
        assert.equal(validated.body.status, "validated");
        assert.match(validated.body.receipt_number, /^HOPE-\d{4}-\d{6}$/);

        const payment = await paymentRepo.findById(validated.body.payment_id);
        assert.equal(payment.status, "succeeded");
        assert.equal(payment.provider, "offline");
        assert.equal(payment.method, "check");
        assert.equal(payment.receipt_note, "Chèque n° 0012345");
        assert.equal(payment.project_id, projectId);

        assert.equal((await checker.post(`/api/fundraising/admin/offline/${id}/validate`)).status, 409, "pas de double validation");
        const log = await lastLog("donation.offline_validated");
        assert.equal(log.meta.offlineId, id);
    });

    it("don en nature : nature imprimee et exclusion du rapprochement", async () => {
        const res = await submit(author, {
            kind: "in_kind", amount: 250000, currency: "xaf", donorName: "Boulangerie du Centre",
            receivedOn: today(), inKindDescription: "200 kg de riz (valeur marché)",
        }, { buffer: PNG_BYTES, filename: "photo.png", contentType: "image/png" });
        assert.equal(res.status, 201);
        const validated = await checker.post(`/api/fundraising/admin/offline/${res.body.id}/validate`);
        assert.equal(validated.status, 200);
        const payment = await paymentRepo.findById(validated.body.payment_id);
        assert.equal(payment.receipt_note, "Don en nature : 200 kg de riz (valeur marché)");
        const { natureLabel } = require("../services/receiptFormat");
        assert.match(natureLabel(payment.method), /nature/);

        const summary = await paymentService.reconcile(null, { source: "test" });
        assert.equal(summary.errors, 0);
        assert.equal((await paymentRepo.findById(payment.id)).status, "succeeded");
    });

    it("refus d'une saisie et liste filtree", async () => {
        const res = await submit(author, { kind: "cash", amount: 5000, currency: "xaf", donorName: "Anonyme", receivedOn: today() });
        const rejected = await checker.post(`/api/fundraising/admin/offline/${res.body.id}/reject`, { reason: "Doublon" });
        assert.equal(rejected.status, 200);
        assert.equal(rejected.body.status, "rejected");
        assert.equal(rejected.body.payment_id, null);
        const list = await author.get("/api/fundraising/admin/offline?status=rejected");
        assert.equal(list.status, 200);
        assert.equal(list.body.length, 1);
    });
});
