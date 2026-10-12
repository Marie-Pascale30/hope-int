const messageRepo = require("../repositories/messageRepository");
const userRepo = require("../repositories/userRepository");
const logService = require("./activityLogService");
const { badRequest, notFound } = require("../utils/httpError");

exports.createMessage = async (payload) => {
    const id = await messageRepo.create(payload);
    await logService.log({ action: "message.created", meta: { messageId: id, email: payload.email } });
    return id;
};

// Les messages n'ont pas de region : liste commune a tous les roles qui les traitent.
exports.list = async (filters, pagination = null) => {
    const result = await messageRepo.getAll(filters, pagination);
    return pagination ? { ...result, page: pagination.page, pageSize: pagination.pageSize } : result;
};

exports.update = async (actor, id, { status, assignedTo, notes }) => {
    const message = await messageRepo.findById(id);
    if (!message) throw notFound("Message introuvable");

    if (assignedTo) {
        const assignee = await userRepo.findById(assignedTo);
        if (!assignee || assignee.status !== "active") throw badRequest("Personne assignée introuvable");
    }

    await messageRepo.update(id, { status, assignedTo, notes });
    await logService.log({
        userId: actor.id,
        action: "message.updated",
        meta: { messageId: id, status, assignedTo },
    });
    return messageRepo.findDetailedById(id);
};

// Statut applique a plusieurs messages (1 a 100), journalise en une entree.
exports.bulkUpdateStatus = async (actor, ids, status) => {
    const unique = [...new Set(ids.map(Number))];
    const updated = await messageRepo.bulkUpdateStatus(unique, status);
    await logService.log({ userId: actor.id, action: "message.bulk_updated", meta: { messageIds: unique, status, updated } });
    return { updated };
};

exports.remove = async (actor, id) => {
    const message = await messageRepo.findById(id);
    if (!message) throw notFound("Message introuvable");
    await messageRepo.remove(id);
    await logService.log({ userId: actor.id, action: "message.deleted", meta: { messageId: id } });
};
