// Workflow de validation des contenus (projets, actualites, temoignages) :
// brouillon -> soumis -> approuve | refuse -> publie.
// - Une personne sans APPROVE_CONTENT, ou restreinte a sa region (directrice regionale), soumet
//   au lieu de publier : son contenu reste hors ligne (published = 0) jusqu'a la decision.
// - Une personne habilitee (APPROVE_CONTENT, portee non regionale) publie directement et traite
//   la file "a valider" ; l'approbation publie (sauf demande contraire) et l'auteur est prevenu.
// published reste la seule donnee lue par le site public.
const { withTransaction } = require("../config/db");
const { hasPermission, isRegionScoped, PERMISSIONS } = require("@hope/shared/rbac");
const contentRepo = require("../repositories/contentRepository");
const reviewRepo = require("../repositories/contentReviewRepository");
const logService = require("./activityLogService");
const emailService = require("./emailService");
const { conflict, notFound } = require("../utils/httpError");

const ORG_NAME = process.env.ORG_NAME || "HOPE International Project";
const ADMIN_URL = () => `${(process.env.FRONTEND_URL || "http://localhost:3001").replace(/\/$/, "")}/admin`;

const TYPE_LABELS = { projects: "projet", news: "actualité", testimonials: "témoignage" };
const ADMIN_PATHS = { projects: "projets", news: "actualites", testimonials: "temoignages" };
const itemName = (type, item) => (type === "testimonials" ? item.author : item.title) || `#${item.id}`;

function canApprove(actor) {
    const roles = actor?.roles || [];
    return hasPermission(roles, PERMISSIONS.APPROVE_CONTENT) && !isRegionScoped(roles);
}
exports.canApprove = canApprove;

// --- Integration a la creation / modification (appelee par contentService) ---

// Creation : prepare le payload et renvoie les champs de relecture a ecrire apres insertion.
// Sans champ published, le contenu est publie (ou soumis) comme avant le workflow.
exports.planCreate = (actor, payload) => {
    const wantsPublish = "published" in payload ? payload.published === 1 : true;
    if (canApprove(actor)) {
        payload.published = wantsPublish ? 1 : 0;
        return wantsPublish
            ? { review_status: "published", reviewed_by: actor.id, reviewed_at: new Date() }
            : { review_status: "draft" };
    }
    payload.published = 0;
    return wantsPublish
        ? { review_status: "submitted", submitted_by: actor.id, submitted_at: new Date(), review_comment: null }
        : { review_status: "draft", submitted_by: actor.id };
};

// Modification : ajuste payload.published et renvoie les champs de relecture (ou null).
// Personne non habilitee : retirer la publication -> brouillon ; demander la publication, ou
// modifier un contenu publie -> soumis (et retire du site jusqu'a la nouvelle validation).
exports.planUpdate = (actor, existing, payload) => {
    const current = existing.review_status;
    if (canApprove(actor)) {
        if (payload.published === 1 && current !== "published") {
            return { review_status: "published", reviewed_by: actor.id, reviewed_at: new Date() };
        }
        if (payload.published === 0 && existing.published) return { review_status: "draft" };
        return null;
    }
    const wants = "published" in payload ? payload.published === 1 : null;
    delete payload.published;
    if (wants === false) {
        if (existing.published || ["submitted", "approved"].includes(current)) {
            payload.published = 0;
            return { review_status: "draft" };
        }
        return null;
    }
    if (wants === true || existing.published || current === "approved") {
        payload.published = 0;
        return { review_status: "submitted", submitted_by: actor.id, submitted_at: new Date(), review_comment: null };
    }
    return null;
};

// Ecrit le statut, l'historique et le journal apres creation / modification.
exports.record = async (actor, type, id, review, { previous } = {}) => {
    if (!review) return;
    await reviewRepo.setReview(type, id, review);
    const status = review.review_status;
    const action = status === "submitted" ? "submit" : status === "published" ? "publish" : "draft";
    if (status === previous && status !== "submitted") return;
    await reviewRepo.addHistory({ type, id, action, actorId: actor.id });
    if (status === "submitted") {
        await logService.log({ userId: actor.id, action: `content.submit.${type}`, meta: { id: Number(id) } });
    }
};

// Soumission explicite (bouton "Soumettre") d'un brouillon ou d'un contenu refuse.
// L'appelant (contentService.submit) a verifie la portee regionale.
exports.submit = async (actor, type, item) => {
    if (item.review_status === "submitted") throw conflict("Ce contenu est déjà en attente de validation");
    if (item.published) throw conflict("Ce contenu est déjà publié");
    await reviewRepo.setReview(type, item.id, {
        review_status: "submitted", submitted_by: actor.id, submitted_at: new Date(), review_comment: null,
    });
    await reviewRepo.addHistory({ type, id: item.id, action: "submit", actorId: actor.id });
    await logService.log({ userId: actor.id, action: `content.submit.${type}`, meta: { id: Number(item.id) } });
    return contentRepo.getById(type, item.id);
};

// --- File "a valider" (APPROVE_CONTENT) ---

exports.getQueue = async ({ status } = {}) => reviewRepo.getQueue({ status: status || "submitted" });

exports.countPending = async () => ({ pending: await reviewRepo.countSubmitted() });

// Apercu complet d'un contenu, avec l'historique de relecture.
exports.getItem = async (type, id) => {
    const item = await contentRepo.getById(type, id);
    if (!item) throw notFound("Contenu introuvable");
    const [history, submitter] = await Promise.all([
        reviewRepo.getHistory(type, id),
        item.submitted_by ? reviewRepo.findUser(item.submitted_by) : null,
    ]);
    return { type, item, history, submitted_by_name: submitter?.name || null };
};

// Email a l'auteur de la soumission (transactionnel), non bloquant.
function notifyAuthor(type, item, decision, comment, actor) {
    if (!item.submitted_by || item.submitted_by === actor.id) return;
    Promise.resolve()
        .then(async () => {
            const author = await reviewRepo.findUser(item.submitted_by);
            if (!author?.email) return;
            const label = TYPE_LABELS[type];
            const name = itemName(type, item);
            const lines = decision === "rejected"
                ? [
                    `Votre ${label} « ${name} » n'a pas été validé(e) pour publication.`,
                    "",
                    "Commentaire de la relecture :",
                    comment,
                    "",
                    `Vous pouvez le modifier puis le soumettre à nouveau : ${ADMIN_URL()}/${ADMIN_PATHS[type]}`,
                ]
                : decision === "published"
                    ? [`Votre ${label} « ${name} » a été validé(e) et publié(e) sur le site.`, ...(comment ? ["", `Commentaire : ${comment}`] : [])]
                    : [`Votre ${label} « ${name} » a été validé(e). Il sera publié prochainement.`, ...(comment ? ["", `Commentaire : ${comment}`] : [])];
            await emailService.send({
                to: author.email,
                subject: decision === "rejected"
                    ? `${ORG_NAME} - Contenu à revoir : ${name}`
                    : `${ORG_NAME} - Contenu validé : ${name}`,
                text: [`Bonjour ${author.name || ""},`.trim(), "", ...lines, "", `L'équipe ${ORG_NAME}`].join("\n"),
            });
        })
        .catch((error) => console.error("content-review-email-error:", error.message));
}

// Decision d'un relecteur. Contenu verrouille : deux decisions simultanees ne se chevauchent pas.
async function decide(actor, type, id, { decision, comment }) {
    const item = await withTransaction(async (connection) => {
        const locked = await reviewRepo.lockItem(connection, type, id);
        if (!locked) throw notFound("Contenu introuvable");
        const allowed = decision === "rejected" ? ["submitted", "approved"] : ["submitted", "approved"];
        if (!allowed.includes(locked.review_status) || (decision === "approved" && locked.review_status === "approved")) {
            throw conflict("Ce contenu n'est pas en attente de validation");
        }
        await reviewRepo.setReview(type, id, {
            review_status: decision,
            review_comment: comment || null,
            reviewed_by: actor.id,
            reviewed_at: new Date(),
            published: decision === "published" ? 1 : 0,
        }, connection);
        await reviewRepo.addHistory({ type, id, action: decision === "rejected" ? "reject" : decision === "published" ? "approve_publish" : "approve", actorId: actor.id, comment: comment || null }, connection);
        return locked;
    });
    const action = decision === "rejected" ? "reject" : "approve";
    await logService.log({
        userId: actor.id,
        action: `content.${action}.${type}`,
        meta: { id: Number(id), ...(decision === "published" ? { published: true } : {}), ...(comment ? { comment: comment.slice(0, 200) } : {}) },
    });
    const updated = await contentRepo.getById(type, id);
    notifyAuthor(type, { ...updated, submitted_by: item.submitted_by }, decision, comment, actor);
    return updated;
}

exports.approve = (actor, type, id, { comment, publish = true } = {}) =>
    decide(actor, type, id, { decision: publish ? "published" : "approved", comment });

exports.reject = (actor, type, id, { comment }) => decide(actor, type, id, { decision: "rejected", comment });
