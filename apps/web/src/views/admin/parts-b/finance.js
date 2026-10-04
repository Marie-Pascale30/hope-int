// Aides de calcul et de mise en forme pour les dons, la finance et le rapport annuel.
// Les libelles et formats dependent de la langue : les fonctions recoivent les formatteurs
// (useFormat()) ou les libelles (useLabels()) en parametre.

// Noms commerciaux des prestataires (identiques dans toutes les langues).
export const PROVIDER_NAMES = { stripe: "Stripe", notchpay: "Notch Pay", flutterwave: "Flutterwave" };
export const PROVIDER_KEYS = Object.keys(PROVIDER_NAMES);
// Moyen de paiement propose par chaque prestataire.
export const PROVIDER_METHOD = { stripe: "card", notchpay: "mobile_money", flutterwave: "mobile_money" };

export const providerName = (provider) => PROVIDER_NAMES[provider] || provider || "—";

// "Carte bancaire (Stripe)" dans la langue courante ; labels : useLabels().
export const providerLabel = (labels, provider, method) =>
  `${method ? labels.method(method) : "—"} (${providerName(provider)})`;

// Le franc CFA a une parite fixe avec l'euro.
export const toEur = (amount, currency, xafPerEur) =>
  String(currency).toLowerCase() === "xaf" ? (Number(amount) || 0) / xafPerEur : Number(amount) || 0;

// Montant net d'un don (deduction d'un remboursement partiel), dans sa devise d'origine.
export const netAmount = (row) => Math.max(0, (Number(row.amount) || 0) - (Number(row.refunded_amount) || 0));

// f : useFormat()
export const formatEur = (f, value) => f.money(value, "eur");
export const formatEurCompact = (f, value) => f.money(value, "eur", { compact: true });
// Mois "AAAA-MM" en abrege ("mars 26", "Mar 26"...).
export const formatMonthKey = (f, month) => f.key(month, { month: "short", year: "2-digit" });

export const percent = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);

// Complete les 12 mois d'une annee (les mois sans don valent 0) ; sans annee, renvoie tel quel.
export function fillMonths(byMonth = [], year) {
  if (!year) return byMonth;
  const known = new Map(byMonth.map((row) => [row.month, row]));
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    return known.get(month) || { month, amountEur: 0, count: 0 };
  });
}

// Annees proposees par defaut : l'annee en cours et les cinq precedentes.
export function recentYears(count = 6) {
  const current = new Date().getFullYear();
  return Array.from({ length: count }, (_, index) => current - index);
}

// Supprime les filtres vides avant l'appel a l'API.
export const cleanParams = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined));

export const todayStamp = () => new Date().toISOString().slice(0, 10);
