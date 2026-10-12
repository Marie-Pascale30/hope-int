// Page publique "Transparence", carte des regions, portraits de l'equipe et administration
// de la publication (annees, documents publics).
//
// Regle de publication : les chiffres d'une annee ne sont exposes qu'apres sa publication par la
// direction (bascule admin), pour ne jamais montrer de chiffres non valides. Seuls des agregats
// sortent (aucune donnee personnelle de donateur) ; les projets non publies sont regroupes.
const transparencyRepo = require("../repositories/transparencyRepository");
const expenseRepo = require("../repositories/expenseRepository");
const budgetRepo = require("../repositories/budgetRepository");
const contentRepo = require("../repositories/contentRepository");
const userRepo = require("../repositories/userRepository");
const logService = require("./activityLogService");
const { removeUpload, removeReplacedUpload } = require("../utils/uploads");
const { badRequest, forbidden, notFound } = require("../utils/httpError");
const { getScopeRegion } = require("../utils/scope");
const { hasGlobalScope, PERMISSIONS, hasPermission } = require("@hope/shared/rbac");
const { REGIONS } = require("@hope/shared/constants");
const { FIRST_TRANSPARENCY_YEAR } = require("@hope/shared/transparency");
const { receiptYear } = require("../utils/timezone");

// Cache memoire des reponses publiques (5 min par defaut ; TRANSPARENCY_CACHE_MS=0 le desactive).
const CACHE_MS = Number(process.env.TRANSPARENCY_CACHE_MS ?? 5 * 60 * 1000);
const cache = new Map();

async function cached(key, compute) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const value = await compute();
    if (CACHE_MS > 0) cache.set(key, { value, expiresAt: Date.now() + CACHE_MS });
    return value;
}

exports.clearCache = () => cache.clear();
exports.CACHE_SECONDS = Math.round(CACHE_MS / 1000);

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

const NOT_PUBLISHED = "Les chiffres de cette année ne sont pas encore publiés";
const DIRECTION_ONLY = "Publication réservée à la direction (rôles à portée nationale)";
const NATIONAL_ONLY = "Documents publics réservés à la finance à portée nationale";

// Les projets non publies (ou supprimes) sont regroupes sous "autres projets" (projectId 0).
function publicProjects(rows) {
    const visible = [];
    let others = 0;
    let general = 0;
    for (const row of rows) {
        if (row.projectId === null) general += row.amountEur;
        else if (row.published && row.title) visible.push({ projectId: row.projectId, title: row.title, amountEur: row.amountEur });
        else others += row.amountEur;
    }
    if (others > 0) visible.push({ projectId: 0, title: null, amountEur: round(others) });
    if (general > 0) visible.push({ projectId: null, title: null, amountEur: round(general) });
    return visible.sort((a, b) => b.amountEur - a.amountEur);
}

function assertYear(year) {
    const value = Number(year);
    const max = receiptYear(new Date());
    if (!Number.isInteger(value) || value < FIRST_TRANSPARENCY_YEAR || value > max) throw badRequest("Année invalide");
    return value;
}

// ---------- Public ----------

// Index : annees publiees (plus recente d'abord) et documents des annees publiees.
exports.getIndex = async () => cached("index", async () => {
    const [years, documents] = await Promise.all([
        transparencyRepo.publishedYears(),
        transparencyRepo.listDocuments({ publishedOnly: true }),
    ]);
    return { years, latest: years[0] || null, documents };
});

exports.getPublicYear = async (rawYear) => {
    const year = assertYear(rawYear);
    return cached(`year:${year}`, async () => {
        const state = await transparencyRepo.getYear(year);
        if (!state?.published) throw notFound(NOT_PUBLISHED);
        const from = `${year}-01-01`;
        const to = `${year}-12-31`;
        const [revenue, byMethod, revenueByProject, expensesByCategory, expensesByProject, impact, documents, years] = await Promise.all([
            transparencyRepo.revenueTotals({ year }),
            transparencyRepo.revenueByMethod({ year }),
            transparencyRepo.revenueByProject({ year }),
            expenseRepo.sumByCategory({ from, to }),
            expenseRepo.sumByProject({ from, to }),
            contentRepo.getImpactTotals({ activeInYear: year }),
            transparencyRepo.listDocuments({ year }),
            transparencyRepo.publishedYears(),
        ]);
        // Budget previsionnel des projets publies qui ont des depenses ou des recettes dans l'annee.
        const projectsWithExpenses = expensesByProject.filter((row) => row.projectId && row.published);
        const planned = await budgetRepo.plannedByProject(projectsWithExpenses.map((row) => row.projectId));
        const expensesTotal = round(expensesByCategory.reduce((sum, row) => sum + row.amountEur, 0));
        return {
            year,
            publishedAt: state.published_at,
            note: state.note || null,
            years,
            revenue: {
                totalEur: revenue.totalEur,
                count: revenue.count,
                byMethod: byMethod.map(({ method, amountEur }) => ({ method, amountEur })),
                byProject: publicProjects(revenueByProject),
            },
            expenses: {
                totalEur: expensesTotal,
                byCategory: expensesByCategory.map(({ category, amountEur }) => ({ category, amountEur })),
                byProject: publicProjects(expensesByProject).map((row) => ({
                    ...row,
                    plannedEur: row.projectId ? planned.get(row.projectId) || 0 : null,
                })),
            },
            balanceEur: round(revenue.totalEur - expensesTotal),
            impact,
            impactScope: "projects_active_in_year",
            documents,
        };
    });
};

// Carte : projets publies, projets en cours et evenements a venir par region (toutes les regions).
exports.getRegions = async () => cached("regions", async () => {
    const { projects, events } = await transparencyRepo.regionCounts();
    const byRegion = new Map(projects.map((row) => [row.region, row]));
    const eventsByRegion = new Map(events.map((row) => [row.region, Number(row.events)]));
    return {
        regions: REGIONS.map((region) => {
            const row = byRegion.get(region);
            return {
                region,
                projects: Number(row?.projects || 0),
                activeProjects: Number(row?.active || 0),
                beneficiaries: Number(row?.beneficiaries || 0),
                events: eventsByRegion.get(region) || 0,
            };
        }),
    };
});

// Groupe d'un portrait : equipe (au moins un role de l'organisation) ou benevoles (membres).
function teamGroup(roles) {
    return roles.some((role) => role !== "membre") ? "team" : "volunteers";
}

function parseRoles(row) {
    try {
        const roles = JSON.parse(row.roles || "[]");
        return Array.isArray(roles) && roles.length ? roles : [row.role || "membre"];
    } catch (_error) {
        return [row.role || "membre"];
    }
}

// Portraits publics : uniquement les comptes actifs qui ont consenti. Ni email, ni identifiant.
exports.getPublicTeam = async () => cached("team", async () => {
    const rows = await transparencyRepo.listPublicTeam();
    return {
        members: rows.map((row) => ({
            name: row.name,
            title: row.public_title || null,
            bio: row.public_bio || null,
            photoUrl: row.public_photo_url || null,
            region: row.region || null,
            group: teamGroup(parseRoles(row)),
        })),
    };
});

// ---------- Portraits : saisie par la personne ou par l'administration ----------

function toProfile(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        region: row.region,
        roles: parseRoles(row),
        publicProfile: Boolean(row.public_profile),
        consentAt: row.public_consent_at || null,
        title: row.public_title || "",
        bio: row.public_bio || "",
        photoUrl: row.public_photo_url || null,
    };
}

exports.getOwnProfile = async (actor) => {
    const row = await transparencyRepo.findTeamProfile(actor.id);
    if (!row) throw notFound("Utilisateur introuvable");
    return toProfile({ ...row, email: actor.email });
};

// photo : fichier image deja verifie (req.file) ; removePhoto : retire la photo actuelle.
async function saveProfile(userId, payload, photo, removePhoto) {
    const row = await transparencyRepo.findTeamProfile(userId);
    if (!row) throw notFound("Utilisateur introuvable");
    const photoUrl = photo ? `/uploads/${photo.filename}` : removePhoto ? null : undefined;
    await transparencyRepo.updateTeamProfile(userId, { ...payload, photoUrl });
    if (photoUrl !== undefined) await removeReplacedUpload(row.public_photo_url, photoUrl);
    exports.clearCache();
    return row;
}

exports.updateOwnProfile = async (actor, payload, photo, { removePhoto = false } = {}) => {
    await saveProfile(actor.id, payload, photo, removePhoto);
    await logService.log({ userId: actor.id, action: "team.profile_self_update", meta: { publicProfile: payload.publicProfile } });
    return exports.getOwnProfile(actor);
};

// Administration (RH) : un acteur restreint a sa region ne gere que les fiches de sa region.
exports.listTeamProfiles = async (actor) => {
    const region = getScopeRegion(actor);
    const rows = await transparencyRepo.listTeamProfiles({ region });
    return { region, profiles: rows.map(toProfile) };
};

exports.updateTeamProfile = async (actor, userId, payload, photo, { removePhoto = false } = {}) => {
    const target = await userRepo.findById(userId);
    if (!target || target.status !== "active") throw notFound("Utilisateur introuvable");
    const region = getScopeRegion(actor);
    if (region && target.region !== region) throw forbidden("Ce compte ne relève pas de votre région");
    await saveProfile(userId, payload, photo, removePhoto);
    await logService.log({ userId: actor.id, action: "team.profile_update", meta: { targetId: userId, publicProfile: payload.publicProfile } });
    const row = await transparencyRepo.findTeamProfile(userId);
    return toProfile({ ...row, email: target.email });
};

// ---------- Publication des annees et documents (direction) ----------

function assertDirection(actor) {
    if (!hasGlobalScope(actor.roles) || !hasPermission(actor.roles, PERMISSIONS.MANAGE_FINANCE)) throw forbidden(DIRECTION_ONLY);
}

exports.listYearsAdmin = async () => {
    const [states, activity] = await Promise.all([transparencyRepo.listYears(), transparencyRepo.activityYears()]);
    const current = receiptYear(new Date());
    const byYear = new Map(states.map((row) => [row.year, row]));
    const years = [...new Set([current, ...activity, ...states.map((row) => row.year)])].sort((a, b) => b - a);
    return {
        years: years.map((year) => {
            const state = byYear.get(year);
            return {
                year,
                published: Boolean(state?.published),
                note: state?.note || "",
                publishedAt: state?.published_at || null,
                publishedBy: state?.published_by_name || null,
            };
        }),
    };
};

exports.setYearPublication = async (actor, rawYear, { published, note }) => {
    assertDirection(actor);
    const year = assertYear(rawYear);
    await transparencyRepo.setYear(year, { published, note, userId: actor.id });
    exports.clearCache();
    await logService.log({ userId: actor.id, action: published ? "transparency.year_publish" : "transparency.year_unpublish", meta: { year } });
    return transparencyRepo.getYear(year);
};

// Documents publics : finance a portee nationale (une directrice regionale n'en depose pas).
function assertNationalFinance(actor) {
    if (getScopeRegion(actor)) throw forbidden(NATIONAL_ONLY);
}

exports.listDocumentsAdmin = async () => ({ documents: await transparencyRepo.listDocuments() });

exports.createDocument = async (actor, { title, year, kind }, file) => {
    assertNationalFinance(actor);
    if (!file) throw badRequest("Joignez le document PDF");
    const value = assertYear(year);
    const id = await transparencyRepo.createDocument({ title, year: value, kind, fileUrl: file.url, fileSize: file.size, userId: actor.id });
    exports.clearCache();
    await logService.log({ userId: actor.id, action: "transparency.document_create", meta: { id, year: value, kind } });
    return transparencyRepo.findDocument(id);
};

exports.removeDocument = async (actor, id) => {
    assertNationalFinance(actor);
    const document = await transparencyRepo.findDocument(id);
    if (!document) throw notFound("Document introuvable");
    await transparencyRepo.removeDocument(id);
    await removeUpload(document.file_url);
    exports.clearCache();
    await logService.log({ userId: actor.id, action: "transparency.document_delete", meta: { id, year: document.year } });
};
