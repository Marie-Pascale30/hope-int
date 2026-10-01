const messageRepo = require("../repositories/messageRepository");
const userRepo = require("../repositories/userRepository");
const logService = require("./activityLogService");
const { badRequest, notFound } = require("../utils/httpError");

exports.createMessage = async (payload) => {
    const id = await messageRepo.create(payload);
    await logService.log({ action: "message.created", meta: { messageId: id, email: payload.email } });
    return id;
};

exports.list = async (filters) => messageRepo.getAll(filters);

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
    const [updated] = (await messageRepo.getAll()).filter((row) => row.id === Number(id));
    return updated;
};

exports.remove = async (actor, id) => {
    const message = await messageRepo.findById(id);
    if (!message) throw notFound("Message introuvable");
    await messageRepo.remove(id);
    await logService.log({ userId: actor.id, action: "message.deleted", meta: { messageId: id } });
};
