// Donnees du parcours de don : montants suggeres, equivalences d'impact, messages Stripe.

export const PRESET_AMOUNTS = {
  eur: [10, 25, 50, 100],
  xaf: [5000, 10000, 25000, 50000],
};

export const DEFAULT_PRESET_INDEX = 1;

// Equivalences indicatives, exprimees en euros (seuil minimal du palier), du plus eleve au plus faible.
const IMPACT_TIERS = [
  { min: 250, text: "le stock de démarrage d’une coopérative agricole : semences améliorées et petit outillage pour cinq familles." },
  { min: 100, text: "trois mois de suivi par un agent de terrain pour un groupement de dix femmes, formations comprises." },
  { min: 50, text: "un premier microcrédit solidaire de 30 000 FCFA pour lancer une activité : beignets, couture ou petit élevage." },
  { min: 25, text: "une formation complète en gestion pour une commerçante : tenir sa caisse, calculer sa marge, fixer ses prix." },
  { min: 10, text: "une séance d’éducation financière pour un groupe de 20 femmes : épargner, budgéter, rembourser." },
  { min: 5, text: "un carnet d’épargne et un cahier de caisse pour une nouvelle membre d’un groupe solidaire." },
  { min: 0, text: "une contribution au fonds solidaire qui finance les prêts des familles accompagnées." },
];

export function impactFor(amountEur) {
  const value = Number(amountEur) || 0;
  return IMPACT_TIERS.find((tier) => value >= tier.min).text;
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

const STRIPE_MESSAGES = {
  card_declined: "Votre carte a été refusée. Vérifiez vos informations ou essayez une autre carte.",
  generic_decline: "Votre carte a été refusée. Contactez votre banque ou essayez une autre carte.",
  insufficient_funds: "Le solde de cette carte est insuffisant pour ce montant.",
  lost_card: "Cette carte a été déclarée perdue : utilisez une autre carte.",
  stolen_card: "Cette carte a été déclarée volée : utilisez une autre carte.",
  expired_card: "Votre carte a expiré. Utilisez une carte en cours de validité.",
  incorrect_cvc: "Le code de sécurité (CVC) est incorrect.",
  invalid_cvc: "Le code de sécurité (CVC) est invalide.",
  incomplete_cvc: "Le code de sécurité (CVC) est incomplet.",
  incorrect_number: "Le numéro de carte est incorrect.",
  invalid_number: "Le numéro de carte est invalide.",
  incomplete_number: "Le numéro de carte est incomplet.",
  invalid_expiry_month: "Le mois d’expiration est invalide.",
  invalid_expiry_year: "L’année d’expiration est invalide.",
  invalid_expiry_year_past: "La date d’expiration est déjà passée.",
  incomplete_expiry: "La date d’expiration est incomplète.",
  processing_error: "Une erreur est survenue pendant le traitement de la carte. Réessayez dans un instant.",
  authentication_required: "Votre banque demande une authentification : réessayez et validez la demande de votre banque.",
  payment_intent_authentication_failure: "L’authentification demandée par votre banque (3D Secure) a échoué ou a été annulée.",
  card_not_supported: "Cette carte ne permet pas ce type de paiement. Essayez une autre carte.",
  currency_not_supported: "Cette carte n’accepte pas les paiements en euros.",
  do_not_honor: "Votre banque a refusé le paiement. Contactez-la ou essayez une autre carte.",
  rate_limit: "Trop de tentatives en peu de temps : patientez quelques instants avant de réessayer.",
};

export function stripeErrorMessage(error) {
  if (!error) return "";
  return (
    STRIPE_MESSAGES[error.decline_code] ||
    STRIPE_MESSAGES[error.code] ||
    (error.type === "validation_error" && error.message) ||
    "Le paiement n’a pas abouti. Réessayez ou utilisez une autre carte."
  );
}
