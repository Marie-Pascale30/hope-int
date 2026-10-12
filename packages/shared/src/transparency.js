// Referentiels de la transparence financiere (budgets, depenses, documents publics),
// partages par l'API et le site.

// Categories de budget et de depenses (memes cles pour le prevu et le realise : les ecarts se
// calculent categorie par categorie). Libelles affiches : dictionnaires du site
// (transparency.categories.<cle>) ; libelles francais ci-dessous pour les exports CSV.
const EXPENSE_CATEGORIES = [
    "training",
    "microcredit",
    "equipment",
    "field_staff",
    "transport",
    "communication",
    "administration",
    "other",
];

const EXPENSE_CATEGORY_LABELS = {
    training: "Formations",
    microcredit: "Fonds de microcrédit",
    equipment: "Équipement et matériel",
    field_staff: "Personnel de terrain",
    transport: "Transport et logistique",
    communication: "Communication et sensibilisation",
    administration: "Frais de fonctionnement",
    other: "Autres",
};

// Types de documents publics (rapports annuels, comptes certifies...).
const PUBLIC_DOCUMENT_KINDS = ["annual_report", "financial_statements", "audit", "other"];

// Bornes de saisie (montants dans la devise de la ligne).
const BUDGET_AMOUNT_MAX = 1000000000;

// Premiere annee acceptee pour une publication ou un document (creation de l'association).
const FIRST_TRANSPARENCY_YEAR = 2000;

// Groupes de la page "L'equipe et les benevoles".
const TEAM_GROUPS = ["team", "volunteers"];

module.exports = {
    EXPENSE_CATEGORIES,
    EXPENSE_CATEGORY_LABELS,
    PUBLIC_DOCUMENT_KINDS,
    BUDGET_AMOUNT_MAX,
    FIRST_TRANSPARENCY_YEAR,
    TEAM_GROUPS,
};
