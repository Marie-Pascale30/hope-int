// Aides de calcul et de mise en forme pour les dons, la finance et le rapport annuel.
import { formatMoney } from "../../../utils/format";
import { PAYMENT_METHOD } from "../../../utils/labels";

export const PROVIDER_LABELS = { stripe: "Stripe", notchpay: "Notch Pay", flutterwave: "Flutterwave" };

export const providerLabel = (provider, method) =>
  `${PAYMENT_METHOD[method] || method || "—"} (${PROVIDER_LABELS[provider] || provider || "—"})`;

// Le franc CFA a une parite fixe avec l'euro.
export const toEur = (amount, currency, xafPerEur) =>
  String(currency).toLowerCase() === "xaf" ? (Number(amount) || 0) / xafPerEur : Number(amount) || 0;

export const formatEur = (value) => formatMoney(value, "eur");
export const formatEurCompact = (value) => formatMoney(value, "eur", { compact: true });

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
