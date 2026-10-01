const applicationRepo = require("../repositories/applicationRepository");
const userRepo = require("../repositories/userRepository");
const userService = require("./userService");
const logService = require("./activityLogService");
const { sendApplicationReceivedEmail, sendApplicationDecisionEmail } = require("./emailService");
const { normalizeRoles } = require("@hope/shared/rbac");
const { badRequest, conflict, notFound } = require("../utils/httpError");

exports.submit = async (payload) => {
    if (await applicationRepo.findOpenByEmail(payload.email)) {
        throw conflict("Une candidature est déjà en cours d'étude pour cet email");
    }
    if (await userRepo.findByEmail(payload.email)) {
        throw conflict("Un compte existe déjà avec cet email : connectez-vous à votre espace");
    }

    const desiredRoles = normalizeRoles(payload.desiredRoles).filter((role) => role !== "admin");
    const id = await applicationRepo.create({ ...payload, desiredRoles: desiredRoles.length ? desiredRoles : ["membre"] });

    await sendApplicationReceivedEmail({ to: payload.email, fullName: payload.name });
    await logService.log({ action: "application.submitted", meta: { applicationId: id, email: payload.email } });
    return id;
};

exports.list = async (filters) => applicationRepo.getAll(filters);

async function getOpen(id) {
    const application = await applicationRepo.findById(id);
    if (!application) throw notFound("Candidature introuvable");
    if (["acceptee", "refusee"].includes(application.status)) {
        throw badRequest("Cette candidature a déjà été clôturée");
    }
    return application;
}

exports.markReviewing = async (actor, id, reviewNote) => {
    await getOpen(id);
    await applicationRepo.updateReview(id, { status: "en_etude", reviewerId: actor.id, reviewNote });
    await logService.log({ userId: actor.id, action: "application.reviewing", meta: { applicationId: id } });
    return applicationRepo.findById(id);
};

exports.reject = async (actor, id, reviewNote) => {
    const application = await getOpen(id);
    await applicationRepo.updateReview(id, { status: "refusee", reviewerId: actor.id, reviewNote });
    await sendApplicationDecisionEmail({ to: application.email, fullName: application.name, accepted: false, note: reviewNote });
    await logService.log({ userId: actor.id, action: "application.rejected", meta: { applicationId: id } });
    return applicationRepo.findById(id);
};

// Accepter = creer le compte avec les roles retenus (memes garde-fous que la creation manuelle).
exports.accept = async (actor, id, { roles, reviewNote }) => {
    const application = await getOpen(id);
    const chosenRoles = normalizeRoles(roles && roles.length ? roles : application.desired_roles);

    const result = await userService.createWithGeneratedPassword(actor, {
        name: application.name,
        email: application.email,
        roles: chosenRoles.length ? chosenRoles : ["membre"],
        phone: application.phone,
        region: application.region,
    });

    await applicationRepo.updateReview(id, {
        status: "acceptee",
        reviewerId: actor.id,
        reviewNote,
        userId: result.user.id,
    });
    await sendApplicationDecisionEmail({ to: application.email, fullName: application.name, accepted: true, note: reviewNote });
    await logService.log({
        userId: actor.id,
        action: "application.accepted",
        meta: { applicationId: id, userId: result.user.id, roles: chosenRoles },
    });

    return { application: await applicationRepo.findById(id), ...result };
};
