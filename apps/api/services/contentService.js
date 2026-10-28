const contentRepo = require("../repositories/contentRepository");
const logService = require("./activityLogService");
const contentReview = require("./contentReviewService");
const { badRequest, forbidden, notFound } = require("../utils/httpError");
const { getScopeRegion } = require("../utils/scope");
const { removeUpload, removeReplacedUpload } = require("../utils/uploads");
const { parseGalleryInput, galleryUploads } = require("../utils/gallery");

const NUMERIC_FIELDS = ["budget", "goal_amount"];
const INTEGER_FIELDS = ["beneficiaries", "trainees", "credits_granted", "project_id"];
const DATE_FIELDS = ["start_date", "end_date"];

const OUT_OF_SCOPE = "Ce contenu ne relève pas de votre région";

function readGalleryInput(value) {
    try {
        return parseGalleryInput(value);
    } catch (error) {
        throw badRequest(error.message);
    }
}

// Les formulaires multipart envoient tout en texte : normalisation des types avant ecriture.
function normalizePayload(body, file) {
    const payload = { ...body };
    // Galerie : chaine JSON (multipart) ou tableau (JSON), deja validee par la route.
    const gallery = "gallery" in payload ? readGalleryInput(payload.gallery) : undefined;
    delete payload.gallery;
    delete payload.image;
    // L'image ne vient que d'un fichier envoye (jamais d'une URL fournie par le client).
    delete payload.image_url;

    Object.keys(payload).forEach((key) => {
        const value = typeof payload[key] === "string" ? payload[key].trim() : payload[key];
        if (value === undefined) {
            delete payload[key];
        } else if (NUMERIC_FIELDS.includes(key)) {
            payload[key] = value === "" || value === null ? null : Number(value);
        } else if (INTEGER_FIELDS.includes(key)) {
            payload[key] = value === "" || value === null ? (key === "project_id" ? null : 0) : parseInt(value, 10);
        } else if (DATE_FIELDS.includes(key)) {
            payload[key] = value ? String(value).slice(0, 10) : null;
        } else if (key === "published") {
            payload[key] = ["1", "true", "on", true, 1].includes(value) ? 1 : 0;
        } else if (["region", "summary", "role_label", "image_alt"].includes(key)) {
            payload[key] = value || null;
        } else {
            payload[key] = value;
        }
    });

    if (gallery !== undefined) payload.gallery = gallery;
    if (file) payload.image_url = `/uploads/${file.filename}`;
    if (payload.remove_image === "1" || payload.remove_image === true) payload.image_url = null;
    delete payload.remove_image;
    return payload;
}

// Images envoyees retirees de la galerie : fichiers supprimes, sauf s'ils restent utilises
// par le contenu (galerie ou image principale).
async function removeDroppedGalleryUploads(existing, payload) {
    const imageUrl = "image_url" in payload ? payload.image_url : existing.image_url;
    const kept = new Set([...galleryUploads(payload.gallery), imageUrl]);
    for (const src of galleryUploads(existing.gallery)) {
        if (!kept.has(src)) await removeUpload(src);
    }
}

// --- Portee regionale (acteur restreint a sa region) ---

// Projet : sa propre region. Actualite / temoignage : la region du projet rattache.
async function getItemRegion(type, item) {
    if (type === "projects") return item.region;
    if (!item.project_id) return null;
    return contentRepo.getProjectRegion(item.project_id);
}

async function assertItemInScope(type, item, region) {
    if (!region) return;
    if ((await getItemRegion(type, item)) !== region) throw forbidden(OUT_OF_SCOPE);
}

// Ecriture par un acteur restreint : projet force dans sa region ; actualite / temoignage
// obligatoirement rattache a un projet de sa region.
async function applyScopeToPayload(type, payload, region, { isCreate }) {
    if (!region) return;
    if (type === "projects") {
        if (isCreate || "region" in payload) payload.region = region;
        return;
    }
    if (!isCreate && !("project_id" in payload)) return;
    if (!payload.project_id) {
        throw forbidden("Rattachez ce contenu à un projet de votre région");
    }
    const projectRegion = await contentRepo.getProjectRegion(payload.project_id);
    if (projectRegion === undefined) throw badRequest("Projet rattaché introuvable");
    if (projectRegion !== region) throw forbidden("Le projet rattaché ne relève pas de votre région");
}

async function getForActor(actor, type, id) {
    const item = await contentRepo.getById(type, id);
    if (!item) throw notFound("Contenu introuvable");
    await assertItemInScope(type, item, getScopeRegion(actor));
    return item;
}

exports.getPublicList = async (type, filters) => contentRepo.getAll(type, { ...filters, publishedOnly: true });

exports.getAdminList = async (actor, type, filters = {}) => {
    const scopeRegion = getScopeRegion(actor);
    return contentRepo.getAll(type, { ...filters, ...(scopeRegion ? { scopeRegion } : {}) });
};

exports.getPublicItem = async (type, id) => {
    const item = await contentRepo.getById(type, id, { publishedOnly: true });
    if (!item) throw notFound("Contenu introuvable");
    return item;
};

exports.create = async (actor, type, body, file) => {
    const region = getScopeRegion(actor);
    const payload = normalizePayload(body, file);
    await applyScopeToPayload(type, payload, region, { isCreate: true });
    // Workflow de validation : sans APPROVE_CONTENT (ou en portee regionale), soumission au lieu
    // de publication.
    const review = contentReview.planCreate(actor, payload);
    const id = await contentRepo.create(type, payload);
    await contentReview.record(actor, type, id, review);
    await logService.log({ userId: actor.id, action: `content.create.${type}`, meta: { id, ...(region ? { region } : {}) } });
    return contentRepo.getById(type, id);
};

exports.update = async (actor, type, id, body, file) => {
    const existing = await getForActor(actor, type, id);
    const payload = normalizePayload(body, file);
    await applyScopeToPayload(type, payload, getScopeRegion(actor), { isCreate: false });
    const review = contentReview.planUpdate(actor, existing, payload);
    await contentRepo.update(type, id, payload);
    await contentReview.record(actor, type, id, review, { previous: existing.review_status });
    if ("image_url" in payload) await removeReplacedUpload(existing.image_url, payload.image_url);
    if ("gallery" in payload) await removeDroppedGalleryUploads(existing, payload);
    await logService.log({ userId: actor.id, action: `content.update.${type}`, meta: { id } });
    return contentRepo.getById(type, id);
};

// Image envoyee seule (galeries photos) : le fichier est verifie et enregistre par le middleware
// d'upload ; son adresse est ensuite enregistree avec le contenu (champ gallery).
exports.uploadImage = async (actor, file) => {
    if (!file) throw badRequest("Aucune image envoyée");
    const url = `/uploads/${file.filename}`;
    await logService.log({ userId: actor.id, action: "content.upload", meta: { url } });
    return { url };
};

// Soumission explicite d'un brouillon ou d'un contenu refuse (portee regionale verifiee).
exports.submit = async (actor, type, id) => {
    const item = await getForActor(actor, type, id);
    return contentReview.submit(actor, type, item);
};

exports.remove = async (actor, type, id) => {
    const existing = await getForActor(actor, type, id);
    if (!(await contentRepo.remove(type, id))) throw notFound("Contenu introuvable");
    if (existing.image_url) await removeUpload(existing.image_url);
    for (const src of galleryUploads(existing.gallery)) await removeUpload(src);
    await logService.log({ userId: actor.id, action: `content.delete.${type}`, meta: { id } });
};
