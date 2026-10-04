// Donnees du parcours de don : montants suggeres, equivalences d'impact, messages Stripe.

export const PRESET_AMOUNTS = {
  eur: [10, 25, 50, 100],
  xaf: [5000, 10000, 25000, 50000],
};

export const DEFAULT_PRESET_INDEX = 1;

// Equivalences indicatives, exprimees en euros (seuil minimal du palier), du plus eleve au plus faible.
// Textes : account.donate.impact.<cle> (ICU, variable {amount} = montant du microcredit en FCFA).
const IMPACT_TIERS = [
  { min: 250, key: "cooperative" },
  { min: 100, key: "fieldAgent" },
  { min: 50, key: "microcredit" },
  { min: 25, key: "training" },
  { min: 10, key: "education" },
  { min: 5, key: "savingsBook" },
  { min: 0, key: "fund" },
];

// Cle de traduction de l'equivalence d'impact d'un montant en euros.
export function impactKey(amountEur) {
  const value = Number(amountEur) || 0;
  return IMPACT_TIERS.find((tier) => value >= tier.min).key;
}

// Conversion indicative entre devises, arrondie pour rester lisible.
export function convertAmount(amount, from, to, xafPerEur) {
  if (from === to) return amount;
  if (to === "xaf") return Math.round((amount * xafPerEur) / 100) * 100;
  return Math.max(1, Math.round(amount / xafPerEur));
}

export function toEur(amount, currency, xafPerEur) {
  return currency === "xaf" ? amount / xafPerEur : amount;
}

// "25", "25,50", "10 000" -> nombre (NaN si invalide).
export function parseAmount(value, currency) {
  const normalized = String(value || "").replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const amount = Number(normalized);
  return currency === "xaf" ? Math.round(amount) : amount;
}

// Codes Stripe pour lesquels un message plus explicite est fourni (account.stripe.<code>).
const STRIPE_CODES = new Set([
  "card_declined", "generic_decline", "insufficient_funds", "lost_card", "stolen_card", "expired_card",
  "incorrect_cvc", "invalid_cvc", "incomplete_cvc", "incorrect_number", "invalid_number", "incomplete_number",
  "invalid_expiry_month", "invalid_expiry_year", "invalid_expiry_year_past", "incomplete_expiry",
  "processing_error", "authentication_required", "payment_intent_authentication_failure", "card_not_supported",
  "currency_not_supported", "do_not_honor", "rate_limit",
]);

// t : useTranslations("account.stripe"). Pour un code inconnu, le message de Stripe (deja localise
// d'apres la langue passee a Stripe.js / Elements) est affiche pour les erreurs de saisie et de carte.
export function stripeErrorMessage(error, t) {
  if (!error) return "";
  if (STRIPE_CODES.has(error.decline_code)) return t(error.decline_code);
  if (STRIPE_CODES.has(error.code)) return t(error.code);
  if ((error.type === "validation_error" || error.type === "card_error") && error.message) return error.message;
  return t("fallback");
}
