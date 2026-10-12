// Budget previsionnel et depenses par projet (finance), ecarts prevu / realise et export
// "bailleurs". Portee regionale : un acteur restreint a sa region ne voit et ne saisit que les
// projets de sa region, jamais les frais generaux (non rattaches a un projet).
const budgetRepo = require("../repositories/budgetRepository");
const expenseRepo = require("../repositories/expenseRepository");
const transparencyRepo = require("../repositories/transparencyRepository");
const contentRepo = require("../repositories/contentRepository");
const logService = require("./activityLogService");
const { csvCell } = require("./adminService");
const { removeReceipt, resolveReceipt } = require("./transparencyFiles");
const { getScopeRegion } = require("../utils/scope");
const { monthStart } = require("../utils/timezone");
const { badRequest, forbidden, notFound } = require("../utils/httpError");
const { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } = require("@hope/shared/transparency");
const { XAF_PER_EUR } = require("@hope/shared/constants");

const OUT_OF_REGION = "Ce projet ne relève pas de votre région";
const GENERAL_COSTS_RESERVED = "Les frais généraux sont réservés aux rôles à portée nationale";

const round = (value) => Math.round(Number(value || 0) * 100) / 100;
const toEur = (amount, currency) => (currency === "xaf" ? Number(amount) / XAF_PER_EUR : Number(amount));

// Projet dans la portee de l'acteur (404 s'il n'existe pas, 403 hors de sa region).
async function assertProjectInScope(actor, projectId) {
    const region = await contentRepo.getProjectRegion(projectId);
    if (region === undefined) throw notFound("Projet introuvable");
    const scope = getScopeRegion(actor);
    if (scope && region !== scope) throw forbidden(OUT_OF_REGION);
    return region;
}

// Depense : projet facultatif (frais generaux reserves aux roles a portee nationale).
async function assertExpenseTarget(actor, projectId) {
    if (projectId) return assertProjectInScope(actor, projectId);
    if (getScopeRegion(actor)) throw forbidden(GENERAL_COSTS_RESERVED);
    return null;
}

// Ecarts par categorie : prevu, realise, ecart (realise - prevu) et taux de realisation.
function mergeVariance(planned, spent) {
    const byKey = new Map();
    for (const row of planned) byKey.set(row.category, { category: row.category, plannedEur: row.plannedEur, spentEur: 0 });
    for (const row of spent) {
        const current = byKey.get(row.category) || { category: row.category, plannedEur: 0, spentEur: 0 };
        current.spentEur = row.amountEur;
        byKey.set(row.category, current);
    }
    const order = (category) => {
        const index = EXPENSE_CATEGORIES.indexOf(category);
        return index === -1 ? EXPENSE_CATEGORIES.length : index;
    };
    return [...byKey.values()]
        .sort((a, b) => order(a.category) - order(b.category))
        .map((row) => ({
            ...row,
            varianceEur: round(row.spentEur - row.plannedEur),
            rate: row.plannedEur > 0 ? Math.round((row.spentEur / row.plannedEur) * 1000) / 10 : null,
        }));
}

function totalsOf(rows) {
    const plannedEur = round(rows.reduce((sum, row) => sum + row.plannedEur, 0));
    const spentEur = round(rows.reduce((sum, row) => sum + row.spentEur, 0));
    return {
        plannedEur,
        spentEur,
        varianceEur: round(spentEur - plannedEur),
        rate: plannedEur > 0 ? Math.round((spentEur / plannedEur) * 1000) / 10 : null,
    };
}

exports.mergeVariance = mergeVariance;

// Vue d'ensemble : projets de la portee avec prevu, realise et ecart (tous temps).
exports.listProjects = async (actor) => {
    const scopeRegion = getScopeRegion(actor);
    const projects = await contentRepo.getAll("projects", scopeRegion ? { scopeRegion } : {});
    const ids = projects.map((project) => project.id);
    const [planned, spent] = await Promise.all([
        budgetRepo.plannedByProject(ids),
        expenseRepo.sumByProject(scopeRegion ? { region: scopeRegion } : {}),
    ]);
    const spentById = new Map(spent.map((row) => [row.projectId, row.amountEur]));
    const rows = projects.map((project) => {
        const plannedEur = planned.get(project.id) || 0;
        const spentEur = spentById.get(project.id) || 0;
        return {
            id: project.id,
            title: project.title,
            region: project.region,
            status: project.status,
            published: project.published,
            raisedEur: project.raised_eur,
            plannedEur,
            spentEur,
            varianceEur: round(spentEur - plannedEur),
            rate: plannedEur > 0 ? Math.round((spentEur / plannedEur) * 1000) / 10 : null,
        };
    });
    return {
        region: scopeRegion,
        projects: rows,
        // Frais generaux : visibles des seuls roles a portee nationale.
        generalCostsEur: scopeRegion ? null : spentById.get(null) || 0,
    };
};

exports.getProjectBudget = async (actor, projectId) => {
    await assertProjectInScope(actor, projectId);
    const project = await contentRepo.getById("projects", projectId);
    const [lines, expenses, planned, spent] = await Promise.all([
        budgetRepo.listForProject(projectId),
        expenseRepo.list({ projectId }),
        budgetRepo.plannedByCategory(projectId),
        expenseRepo.sumByCategory({ projectId }),
    ]);
    const byCategory = mergeVariance(planned, spent);
    return {
        project: {
            id: project.id,
            title: project.title,
            region: project.region,
            status: project.status,
            start_date: project.start_date,
            end_date: project.end_date,
            raisedEur: project.raised_eur,
        },
        lines,
        expenses,
        byCategory,
        totals: totalsOf(byCategory),
    };
};

// ---------- Lignes de budget ----------

exports.createLine = async (actor, projectId, payload) => {
    await assertProjectInScope(actor, projectId);
    const id = await budgetRepo.create({ projectId, ...payload, userId: actor.id });
    await logService.log({ userId: actor.id, action: "budget.line_create", meta: { id, projectId, category: payload.category } });
    return { id };
};

async function loadLine(actor, id) {
    const line = await budgetRepo.findById(id);
    if (!line) throw notFound("Ligne de budget introuvable");
    const scope = getScopeRegion(actor);
    if (scope && line.project_region !== scope) throw forbidden(OUT_OF_REGION);
    return line;
}

exports.updateLine = async (actor, id, payload) => {
    const line = await loadLine(actor, id);
    await budgetRepo.update(id, payload);
    await logService.log({ userId: actor.id, action: "budget.line_update", meta: { id, projectId: line.project_id } });
};

exports.removeLine = async (actor, id) => {
    const line = await loadLine(actor, id);
    await budgetRepo.remove(id);
    await logService.log({ userId: actor.id, action: "budget.line_delete", meta: { id, projectId: line.project_id } });
};

// ---------- Depenses ----------

exports.listExpenses = async (actor, filters = {}) => {
    const scope = getScopeRegion(actor);
    if (filters.projectId) await assertProjectInScope(actor, filters.projectId);
    const scoped = { ...filters, ...(scope ? { region: scope } : {}) };
    const [items, byCategory] = await Promise.all([expenseRepo.list(scoped), expenseRepo.sumByCategory(scoped)]);
    return { items, byCategory, totalEur: round(byCategory.reduce((sum, row) => sum + row.amountEur, 0)) };
};

async function loadExpense(actor, id) {
    const expense = await expenseRepo.findRawById(id);
    if (!expense) throw notFound("Dépense introuvable");
    const scope = getScopeRegion(actor);
    if (scope && expense.project_region !== scope) throw forbidden(OUT_OF_REGION);
    return expense;
}

const receiptFields = (file) => (file ? { receiptPath: file.name, receiptMime: file.mime, receiptName: file.originalName } : {});

exports.createExpense = async (actor, payload, file) => {
    await assertExpenseTarget(actor, payload.projectId);
    const id = await expenseRepo.create({ ...payload, ...receiptFields(file), userId: actor.id });
    await logService.log({
        userId: actor.id,
        action: "budget.expense_create",
        meta: { id, projectId: payload.projectId || null, category: payload.category, amount: payload.amount, currency: payload.currency },
    });
    return expenseRepo.toPublic(await expenseRepo.findRawById(id));
};

// removeReceipt : retire le justificatif existant sans le remplacer.
exports.updateExpense = async (actor, id, payload, file, { removeReceipt: dropReceipt = false } = {}) => {
    const expense = await loadExpense(actor, id);
    await assertExpenseTarget(actor, payload.projectId);
    const replacing = Boolean(file) || dropReceipt;
    await expenseRepo.update(id, {
        ...payload,
        ...(file ? receiptFields(file) : dropReceipt ? { receiptPath: null, receiptMime: null, receiptName: null } : {}),
    });
    if (replacing && expense.receipt_path) await removeReceipt(expense.receipt_path);
    await logService.log({ userId: actor.id, action: "budget.expense_update", meta: { id, projectId: payload.projectId || null } });
    return expenseRepo.toPublic(await expenseRepo.findRawById(id));
};

exports.removeExpense = async (actor, id) => {
    const expense = await loadExpense(actor, id);
    await expenseRepo.remove(id);
    if (expense.receipt_path) await removeReceipt(expense.receipt_path);
    await logService.log({
        userId: actor.id,
        action: "budget.expense_delete",
        meta: { id, projectId: expense.project_id, amount: expense.amount, currency: expense.currency },
    });
};

// Justificatif : chemin disque verifie, type et nom d'origine (route authentifiee uniquement).
exports.getReceipt = async (actor, id) => {
    const expense = await loadExpense(actor, id);
    const full = expense.receipt_path ? resolveReceipt(expense.receipt_path) : null;
    if (!full) throw notFound("Aucun justificatif pour cette dépense");
    await logService.log({ userId: actor.id, action: "budget.receipt_download", meta: { id } });
    return { path: full, mime: expense.receipt_mime || "application/octet-stream", name: expense.receipt_name || `justificatif-${id}` };
};

// ---------- Export "bailleurs" ----------

// Debut (minuit local, fuseau des recus) d'une date AAAA-MM-JJ. Le fuseau par defaut
// (Africa/Douala) n'a pas d'heure d'ete : le decalage du premier du mois vaut pour tout le mois.
function dayStart(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(monthStart(year, month - 1).getTime() + (day - 1) * 86400000);
}

function nextDay(value) {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

const decimal = (value) => round(value).toFixed(2).replace(".", ",");
const METHOD_LABELS = { card: "Carte bancaire", mobile_money: "Mobile Money" };

// CSV (separateur ";", BOM UTF-8, virgule decimale) : indicateurs du projet, recettes nettes de la
// periode (par moyen de paiement), prevu / realise / ecart par categorie et detail des depenses.
// Aucune donnee personnelle de donateur. Journalise.
exports.exportDonorReport = async (actor, projectId, { from, to } = {}) => {
    await assertProjectInScope(actor, projectId);
    if (from && to && from > to) throw badRequest("Période invalide : la date de début doit précéder la date de fin");
    const project = await contentRepo.getById("projects", projectId);
    const revenueFilters = {
        projectId,
        ...(from ? { from: dayStart(from) } : {}),
        ...(to ? { to: dayStart(nextDay(to)) } : {}),
    };
    const expenseFilters = { projectId, from, to };
    const [revenue, byMethod, planned, spent, expenses] = await Promise.all([
        transparencyRepo.revenueTotals(revenueFilters),
        transparencyRepo.revenueByMethod(revenueFilters),
        budgetRepo.plannedByCategory(projectId),
        expenseRepo.sumByCategory(expenseFilters),
        expenseRepo.list(expenseFilters, { limit: 100000 }),
    ]);
    const byCategory = mergeVariance(planned, spent);
    const totals = totalsOf(byCategory);
    const label = (category) => EXPENSE_CATEGORY_LABELS[category] || category;
    const row = (...cells) => cells.map((cell) => (typeof cell === "number" ? String(cell) : csvCell(cell))).join(";");

    const lines = [
        row("Rapport bailleurs", project.title),
        row("Région", project.region || "—"),
        row("Période", `${from || "début"} → ${to || "aujourd'hui"}`),
        row("Généré le", new Date().toISOString()),
        row("Montants", "EUR (franc CFA converti à la parité fixe de 655,957 XAF pour 1 EUR)"),
        "",
        row("Indicateurs", "Valeur"),
        row("Bénéficiaires (beneficiaries)", Number(project.beneficiaries) || 0),
        row("Personnes formées (trainees)", Number(project.trainees) || 0),
        row("Microcrédits accordés (credits_granted)", Number(project.credits_granted) || 0),
        "",
        row("Recettes nettes des remboursements", "Montant (EUR)", "Nombre de dons"),
        row("Total", decimal(revenue.totalEur), revenue.count),
        ...byMethod.map((item) => row(METHOD_LABELS[item.method] || item.method, decimal(item.amountEur), item.count)),
        "",
        row("Dépenses par catégorie", "Prévu (EUR)", "Réalisé (EUR)", "Écart (EUR)", "Taux de réalisation (%)"),
        ...byCategory.map((item) => row(
            label(item.category), decimal(item.plannedEur), decimal(item.spentEur), decimal(item.varianceEur),
            item.rate === null ? "—" : String(item.rate).replace(".", ",")
        )),
        row("Total", decimal(totals.plannedEur), decimal(totals.spentEur), decimal(totals.varianceEur),
            totals.rate === null ? "—" : String(totals.rate).replace(".", ",")),
        row("Solde (recettes - dépenses)", decimal(revenue.totalEur - totals.spentEur)),
        "",
        row("Détail des dépenses", "Date", "Catégorie", "Description", "Montant", "Devise", "Équivalent EUR", "Justificatif"),
        ...expenses.map((item) => row(
            "", item.spent_on, label(item.category), item.description,
            item.currency === "xaf" ? String(Math.round(item.amount)) : decimal(item.amount),
            String(item.currency).toUpperCase(), decimal(toEur(item.amount, item.currency)), item.has_receipt ? "oui" : "non"
        )),
    ];

    await logService.log({
        userId: actor.id,
        action: "transparency.export_donor_report",
        meta: { projectId, from: from || null, to: to || null, expenses: expenses.length },
    });
    return { csv: `﻿${lines.join("\r\n")}`, project };
};
