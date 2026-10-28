// Collectes personnelles : un membre cree une page de collecte rattachee a un projet (titre,
// histoire, objectif, date de fin, photo facultative). Moderation (MANAGE_CONTENT) avant
// publication ; page publique /collecte/<slug> ; les dons attribues (payments.fundraiser_id)
// comptent aussi pour le projet (project_id du don = projet de la collecte).
const pageRepo = require("../repositories/fundraisingPageRepository");
const contentRepo = require("../repositories/contentRepository");
const emailService = require("./emailService");
const logService = require("./activityLogService");
const { singleLine } = require("./donationExtras");
const { FUNDRAISER_LIMITS, FUNDRAISER_GOAL } = require("@hope/shared/fundraising");
const { badRequest, conflict, notFound } = require("../utils/httpError");
const { removeUpload } = require("../utils/uploads");
const { FRONTEND_URL, randomToken } = require("../utils/security");

const ORG_NAME = process.env.ORG_NAME || "HOPE International Project";
const MAX_DURATION_DAYS = 366;

// Histoire : texte brut multiligne (rendu en texte par le site, jamais en HTML).
function cleanStory(value) {
    return String(value ?? "")
        .normalize("NFC")
        .replace(/\r\n?/g, "\n")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function slugify(title) {
    const base = title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/g, "");
    return `${base || "collecte"}-${randomToken(3)}`;
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

async function checkProject(projectId) {
    const project = await contentRepo.getById("projects", Number(projectId), { publishedOnly: true });
    if (!project) throw badRequest("Projet introuvable");
    if (project.status === "termine") throw badRequest("Ce projet est terminé : il ne reçoit plus de dons");
    return project;
}

function checkFields(input, { partial = false } = {}) {
    const out = {};
    if (!partial || input.title !== undefined) {
        out.title = singleLine(input.title, FUNDRAISER_LIMITS.title);
        if (out.title.length < 5) throw badRequest("Titre de la collecte : 5 caractères minimum");
    }
    if (!partial || input.story !== undefined) {
        out.story = cleanStory(input.story);
        if (out.story.length < FUNDRAISER_LIMITS.storyMin || out.story.length > FUNDRAISER_LIMITS.story) {
            throw badRequest("Histoire de la collecte : entre 50 et 5000 caractères");
        }
    }
    if (!partial || input.goalAmount !== undefined || input.currency !== undefined) {
        out.currency = input.currency === "xaf" ? "xaf" : "eur";
        const goal = out.currency === "xaf" ? Math.round(Number(input.goalAmount)) : Math.round(Number(input.goalAmount) * 100) / 100;
        const { min, max } = FUNDRAISER_GOAL[out.currency];
        if (!(goal >= min && goal <= max)) throw badRequest(`L'objectif doit être compris entre ${min} et ${max} ${out.currency.toUpperCase()}`);
        out.goalAmount = goal;
    }
    if (input.endsOn !== undefined) {
        const value = input.endsOn ? String(input.endsOn).slice(0, 10) : null;
        if (value) {
            const limit = new Date(Date.now() + MAX_DURATION_DAYS * 86400000).toISOString().slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < today() || value > limit) {
                throw badRequest("Date de fin invalide (dans l'année à venir)");
            }
        }
        out.endsOn = value;
    }
    return out;
}

// Vue publique : sans email ni identifiants internes de l'organisateur.
function publicView(fundraiser, supporters = []) {
    return {
        slug: fundraiser.slug,
        title: fundraiser.title,
        story: fundraiser.story,
        goal_amount: fundraiser.goal_amount,
        currency: fundraiser.currency,
        raised: fundraiser.raised,
        supporters_count: fundraiser.supporters,
        ends_on: fundraiser.ends_on,
        image_url: fundraiser.image_url,
        status: fundraiser.status,
        open: fundraiser.status === "published" && (!fundraiser.ends_on || fundraiser.ends_on >= today()),
        organizer: String(fundraiser.organizer_name || "").split(" ")[0] || null,
        project_id: fundraiser.project_id,
        project_title: fundraiser.project_title,
        published_at: fundraiser.published_at,
        supporters: supporters.map((row) => ({
            id: row.id,
            name: row.public_anonymous ? null : supporterName(row.donor_name),
            date: row.paid_at,
        })),
    };
}

// Prenom + initiale du nom ("Marie N.") : jamais le nom complet sur une page publique.
function supporterName(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    return parts.length > 1 ? `${parts[0]} ${parts.at(-1)[0].toUpperCase()}.` : parts[0];
}

exports.supporterName = supporterName;

exports.create = async (user, input, file) => {
    const fields = checkFields(input);
    const project = await checkProject(input.projectId);
    let slug = slugify(fields.title);
    while (await pageRepo.slugExists(slug)) slug = slugify(fields.title);
    const id = await pageRepo.create({
        ...fields,
        userId: user.id,
        projectId: project.id,
        slug,
        imageUrl: file?.filename ? `/uploads/${file.filename}` : null,
    });
    await logService.log({ userId: user.id, action: "fundraiser.created", meta: { fundraiserId: id, projectId: project.id } });
    return pageRepo.findById(id);
};

exports.getMine = async (user) => pageRepo.getByUser(user.id);

// L'organisateur modifie sa collecte tant qu'elle n'est pas publiee (une collecte refusee repart
// en moderation) ; une collecte publiee peut seulement etre cloturee.
exports.updateMine = async (user, id, input, file) => {
    const fundraiser = await pageRepo.findById(id);
    if (!fundraiser || fundraiser.user_id !== user.id) throw notFound("Collecte introuvable");
    if (input.status === "closed") {
        if (fundraiser.status !== "published") throw badRequest("Seule une collecte publiée peut être clôturée");
        await pageRepo.update(id, { status: "closed" });
        await logService.log({ userId: user.id, action: "fundraiser.closed", meta: { fundraiserId: id } });
        return pageRepo.findById(id);
    }
    if (!["pending", "rejected"].includes(fundraiser.status)) {
        throw conflict("Une collecte publiée ne peut plus être modifiée : contactez l'équipe");
    }
    const changes = checkFields(input, { partial: true });
    if (input.projectId !== undefined) changes.projectId = (await checkProject(input.projectId)).id;
    if (file?.filename) changes.imageUrl = `/uploads/${file.filename}`;
    changes.status = "pending";
    await pageRepo.update(id, changes);
    if (changes.imageUrl && fundraiser.image_url) await removeUpload(fundraiser.image_url);
    await logService.log({ userId: user.id, action: "fundraiser.updated", meta: { fundraiserId: id } });
    return pageRepo.findById(id);
};

exports.getPublic = async (slug) => {
    const fundraiser = await pageRepo.findBySlug(String(slug));
    if (!fundraiser || !["published", "closed"].includes(fundraiser.status)) throw notFound("Collecte introuvable");
    return publicView(fundraiser, await pageRepo.getRecentSupporters(fundraiser.id, 10));
};

exports.listPublic = async ({ projectId } = {}) =>
    (await pageRepo.getPublished({ projectId })).map((fundraiser) => {
        const { story: _story, supporters: _supporters, ...rest } = publicView(fundraiser);
        return rest;
    });

exports.list = async ({ status } = {}) => pageRepo.getAll({ status });

exports.moderate = async (actor, id, { decision, note }) => {
    const fundraiser = await pageRepo.findById(id);
    if (!fundraiser) throw notFound("Collecte introuvable");
    const status = decision === "approve" ? "published" : "rejected";
    const cleanNote = note ? singleLine(note, 500) : null;
    if (!(await pageRepo.moderate(id, { status, note: cleanNote, moderatorId: actor.id }))) {
        throw conflict("Cette collecte a déjà été modérée");
    }
    await logService.log({ userId: actor.id, action: `fundraiser.${status}`, meta: { fundraiserId: id, organizerId: fundraiser.user_id } });

    const organizer = await require("../repositories/userRepository").findById(fundraiser.user_id).catch(() => null);
    if (organizer?.email) {
        await emailService.send({
            to: organizer.email,
            subject: status === "published" ? `${ORG_NAME} - Votre collecte est en ligne` : `${ORG_NAME} - Votre collecte`,
            text: [
                `Bonjour ${organizer.name},`,
                "",
                status === "published"
                    ? `Votre collecte « ${fundraiser.title} » est publiée. Partagez-la autour de vous : ${FRONTEND_URL}/collecte/${fundraiser.slug}`
                    : `Votre collecte « ${fundraiser.title} » n'a pas pu être publiée en l'état. Vous pouvez la modifier depuis votre espace membre puis la soumettre de nouveau.`,
                cleanNote ? `\nMessage de l'équipe : ${cleanNote}` : "",
                "",
                `L'équipe ${ORG_NAME}`,
            ].join("\n"),
        });
    }
    return pageRepo.findById(id);
};
