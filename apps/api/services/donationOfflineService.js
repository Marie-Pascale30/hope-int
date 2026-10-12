// Dons hors ligne saisis par la finance (especes, virement, cheque, en nature valorise), avec
// justificatif. Saisie "en attente de validation", puis validation par une SECONDE personne ayant
// la permission finance (jamais l'auteur) : le don est alors enregistre, confirme, et son recu
// numerote emis dans la meme transaction. Prestataire "offline" : hors rapprochement.
const db = require("../config/db");
const offlineRepo = require("../repositories/donationOfflineRepository");
const paymentRepo = require("../repositories/paymentRepository");
const contentRepo = require("../repositories/contentRepository");
const receiptService = require("./receiptService");
const logService = require("./activityLogService");
const { sendReceipt } = require("./payments/statusService");
const { singleLine, shortMessage } = require("./donationExtras");
const { OFFLINE_KINDS } = require("@hope/shared/fundraising");
const { DONATION_LIMITS } = require("@hope/shared/constants");
const { badRequest, conflict, forbidden, notFound } = require("../utils/httpError");
const { getScopeRegion } = require("../utils/scope");
const { randomToken } = require("../utils/security");

const REFERENCE_LABELS = { check: "Chèque n°", transfer: "Virement, réf." };

function roundAmount(amount, currency) {
    return currency === "xaf" ? Math.round(Number(amount)) : Math.round(Number(amount) * 100) / 100;
}

exports.create = async (actor, input, proof) => {
    if (!OFFLINE_KINDS.includes(input.kind)) throw badRequest("Type de don hors ligne invalide");
    const currency = input.currency === "xaf" ? "xaf" : "eur";
    const amount = roundAmount(input.amount, currency);
    const limits = DONATION_LIMITS[currency];
    if (!(amount >= limits.min && amount <= limits.max)) {
        throw badRequest(`Le montant doit être compris entre ${limits.min} et ${limits.max} ${currency.toUpperCase()}`);
    }
    const donorName = singleLine(input.donorName, 150);
    if (donorName.length < 2) throw badRequest("Nom et email du donateur obligatoires");
    const inKindDescription = singleLine(input.inKindDescription, 200);
    if (input.kind === "in_kind" && inKindDescription.length < 3) throw badRequest("Décrivez le don en nature et sa valorisation");
    const receivedOn = String(input.receivedOn || "").slice(0, 10);
    const received = new Date(`${receivedOn}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn) || Number.isNaN(received.getTime()) || received.getTime() > Date.now() + 86400000) {
        throw badRequest("Date de réception invalide");
    }
    let projectId = null;
    if (input.projectId) {
        const project = await contentRepo.getById("projects", Number(input.projectId));
        if (!project) throw badRequest("Projet introuvable");
        projectId = project.id;
    }

    const id = await offlineRepo.create({
        kind: input.kind,
        amount,
        currency,
        donorName,
        donorEmail: input.donorEmail ? String(input.donorEmail).trim().toLowerCase() : null,
        projectId,
        receivedOn,
        reference: singleLine(input.reference, 100) || null,
        inKindDescription: input.kind === "in_kind" ? inKindDescription : null,
        note: shortMessage(input.note, 500) || null,
        proof,
        createdBy: actor.id,
    });
    await logService.log({
        userId: actor.id,
        action: "donation.offline_created",
        meta: { offlineId: id, kind: input.kind, amount, currency, hasProof: Boolean(proof) },
    });
    return offlineRepo.findById(id);
};

exports.list = async (actor, { status } = {}) => {
    const region = getScopeRegion(actor);
    return offlineRepo.getAll({ status, ...(region ? { region } : {}) });
};

exports.getProof = async (actor, id) => {
    const entry = await offlineRepo.findById(id);
    if (!entry) throw notFound("Don hors ligne introuvable");
    const region = getScopeRegion(actor);
    if (region && entry.project_region !== region) throw notFound("Don hors ligne introuvable");
    const proof = await offlineRepo.findProof(id);
    if (!proof?.proof_data) throw notFound("Aucun justificatif pour ce don");
    return { buffer: proof.proof_data, mime: proof.proof_mime, name: proof.proof_name || "justificatif" };
};

function receiptNote(entry) {
    if (entry.kind === "in_kind") return `Don en nature : ${entry.in_kind_description}`.slice(0, 255);
    if (entry.reference && REFERENCE_LABELS[entry.kind]) return `${REFERENCE_LABELS[entry.kind]} ${entry.reference}`.slice(0, 255);
    return null;
}

// Validation (4 yeux) : l'auteur de la saisie ne peut pas la valider.
exports.validate = async (actor, id) => {
    const result = await db.withTransaction(async (connection) => {
        const entry = await offlineRepo.lockForDecision(connection, id);
        if (!entry) throw notFound("Don hors ligne introuvable");
        if (entry.status !== "pending_validation") throw conflict("Ce don hors ligne a déjà été traité");
        if (Number(entry.created_by) === Number(actor.id)) {
            throw forbidden("La validation doit être faite par une autre personne que l'auteur de la saisie");
        }
        const payment = await paymentRepo.insertSucceeded(connection, {
            userId: entry.user_id,
            amount: Number(entry.amount),
            currency: entry.currency,
            method: entry.kind,
            provider: "offline",
            txId: `OFF-${entry.id}`,
            donorName: entry.donor_name,
            donorEmail: entry.donor_email,
            projectId: entry.project_id,
            frequency: "once",
            receiptToken: randomToken(24),
            source: "hors-ligne",
            paidAt: new Date(`${entry.received_on}T12:00:00Z`),
        }, { yearOf: receiptService.receiptYear, note: receiptNote(entry) });
        await offlineRepo.markValidated(connection, entry.id, { validatedBy: actor.id, paymentId: payment.id });
        return { entry, payment };
    });

    await logService.log({
        userId: actor.id,
        action: "donation.offline_validated",
        meta: {
            offlineId: result.entry.id,
            paymentId: result.payment.id,
            receiptNumber: result.payment.receiptNumber,
            createdBy: result.entry.created_by,
            amount: Number(result.entry.amount),
            currency: result.entry.currency,
        },
    });
    if (result.entry.donor_email) sendReceipt(result.payment.id);
    return offlineRepo.findById(id);
};

exports.reject = async (actor, id, reason) => {
    const entry = await offlineRepo.findById(id);
    if (!entry) throw notFound("Don hors ligne introuvable");
    if (!(await offlineRepo.markRejected(id, { rejectedBy: actor.id, reason: shortMessage(reason, 500) }))) {
        throw conflict("Ce don hors ligne a déjà été traité");
    }
    await logService.log({ userId: actor.id, action: "donation.offline_rejected", meta: { offlineId: id, createdBy: entry.created_by } });
    return offlineRepo.findById(id);
};
