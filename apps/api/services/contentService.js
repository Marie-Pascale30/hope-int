const contentRepo = require("../repositories/contentRepository");
const logService = require("./activityLogService");
const { notFound } = require("../utils/httpError");

const NUMERIC_FIELDS = ["budget", "goal_amount"];
const INTEGER_FIELDS = ["beneficiaries", "trainees", "credits_granted", "project_id"];
const DATE_FIELDS = ["start_date", "end_date"];

// Les formulaires multipart envoient tout en texte : normalisation des types avant ecriture.
function normalizePayload(body, file) {
    const payload = { ...body };
    delete payload.image;

    Object.keys(payload).forEach((key) => {
        const value = typeof payload[key] === "string" ? payload[key].trim() : payload[key];
        if (NUMERIC_FIELDS.includes(key)) {
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
    if (payload.remove_image === "1") payload.image_url = null;
    delete payload.remove_image;
    return payload;
}

exports.getPublicList = async (type, filters) => contentRepo.getAll(type, { ...filters, publishedOnly: true });
exports.getAdminList = async (type, filters) => contentRepo.getAll(type, filters);

exports.getPublicItem = async (type, id) => {
    const item = await contentRepo.getById(type, id, { publishedOnly: true });
    if (!item) throw notFound("Contenu introuvable");
    return item;
};

exports.create = async (actor, type, body, file) => {
    const id = await contentRepo.create(type, normalizePayload(body, file));
    await logService.log({ userId: actor.id, action: `content.create.${type}`, meta: { id } });
    return contentRepo.getById(type, id);
};

exports.update = async (actor, type, id, body, file) => {
    if (!(await contentRepo.getById(type, id))) throw notFound("Contenu introuvable");
    await contentRepo.update(type, id, normalizePayload(body, file));
    await logService.log({ userId: actor.id, action: `content.update.${type}`, meta: { id } });
    return contentRepo.getById(type, id);
};

exports.remove = async (actor, type, id) => {
    if (!(await contentRepo.remove(type, id))) throw notFound("Contenu introuvable");
    await logService.log({ userId: actor.id, action: `content.delete.${type}`, meta: { id } });
};
