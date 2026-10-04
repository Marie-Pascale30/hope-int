const contentRepo = require("../repositories/contentRepository");
const logService = require("./activityLogService");
const { badRequest, forbidden, notFound } = require("../utils/httpError");
const { getScopeRegion } = require("../utils/scope");
const { removeUpload, removeReplacedUpload } = require("../utils/uploads");

const NUMERIC_FIELDS = ["budget", "goal_amount"];
const INTEGER_FIELDS = ["beneficiaries", "trainees", "credits_granted", "project_id"];
const DATE_FIELDS = ["start_date", "end_date"];

const OUT_OF_SCOPE = "Ce contenu ne relève pas de votre région";

// Les formulaires multipart envoient tout en texte : normalisation des types avant ecriture.
function normalizePayload(body, file) {
    const payload = { ...body };
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
        } else if (key === "region" || key === "summary" || key === "role_label") {
            payload[key] = value || null;
        } else {
            payload[key] = value;
        }
    });

    if (file) payload.image_url = `/uploads/${file.filename}`;
    if (payload.remove_image === "1" || payload.remove_image === true) payload.image_url = null;
    delete payload.remove_image;
    return payload;
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
    const id = await contentRepo.create(type, payload);
    await logService.log({ userId: actor.id, action: `content.create.${type}`, meta: { id, ...(region ? { region } : {}) } });
    return contentRepo.getById(type, id);
};

exports.update = async (actor, type, id, body, file) => {
    const existing = await getForActor(actor, type, id);
    const payload = normalizePayload(body, file);
    await applyScopeToPayload(type, payload, getScopeRegion(actor), { isCreate: false });
    await contentRepo.update(type, id, payload);
    if ("image_url" in payload) await removeReplacedUpload(existing.image_url, payload.image_url);
    await logService.log({ userId: actor.id, action: `content.update.${type}`, meta: { id } });
    return contentRepo.getById(type, id);
};

exports.remove = async (actor, type, id) => {
    const existing = await getForActor(actor, type, id);
    if (!(await contentRepo.remove(type, id))) throw notFound("Contenu introuvable");
    if (existing.image_url) await removeUpload(existing.image_url);
    await logService.log({ userId: actor.id, action: `content.delete.${type}`, meta: { id } });
};
