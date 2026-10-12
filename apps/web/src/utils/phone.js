// Numeros de telephone camerounais (et internationaux pour la diaspora).
//
// Plan de numerotation (ART, a 9 chiffres depuis le 21/11/2014) : indicatif +237 ; un mobile compte
// 9 chiffres et commence par 6. Prefixes des operateurs Mobile Money retenus :
//   - MTN Mobile Money : 67x, 650-654, 680-684
//   - Orange Money     : 69x, 655-659, 685-689
// Attention : la serie 68x est attribuee de facon variable selon les sources (certains agregateurs
// de paiement la classent entierement chez MTN) et la portabilite des numeros existe : l'operateur
// detecte n'est qu'une indication affichee a l'utilisateur, jamais un motif de refus.
// Autres prefixes mobiles (Nexttel 66x, Camtel 62x) : numeros valides, operateur non annonce.

export const CM_DIAL_CODE = "237";

const OPERATORS = [
  { id: "mtn", test: /^6(7\d|5[0-4]|8[0-4])/ },
  { id: "orange", test: /^6(9\d|5[5-9]|8[5-9])/ },
];

const digitsOf = (value) => String(value || "").replace(/\D/g, "");

// Analyse une saisie libre ("677 12 34 56", "+237 6 77...", "00237...", "+33 6 12...").
// Renvoie { kind: "empty" | "cm" | "intl" | "invalid", national?, e164?, operator?, cm? }.
export function parsePhone(input) {
  const raw = String(input || "").trim();
  if (!raw) return { kind: "empty" };
  let digits = digitsOf(raw);
  const international = raw.startsWith("+") || raw.startsWith("00");
  if (raw.startsWith("00")) digits = digits.slice(2);

  // Numero camerounais : 9 chiffres commencant par 6, avec ou sans indicatif.
  let national = null;
  if (international || (digits.startsWith(CM_DIAL_CODE) && digits.length === 12)) {
    if (digits.startsWith(CM_DIAL_CODE)) national = digits.slice(CM_DIAL_CODE.length);
  } else {
    national = digits;
  }
  if (national !== null) {
    if (/^6\d{8}$/.test(national)) {
      const operator = OPERATORS.find((item) => item.test.test(national))?.id || null;
      return { kind: "cm", national, e164: `+${CM_DIAL_CODE}${national}`, operator };
    }
    return { kind: "invalid", cm: true };
  }
  // Autre pays (E.164 : 8 a 15 chiffres indicatif compris).
  if (digits.length >= 8 && digits.length <= 15) return { kind: "intl", e164: `+${digits}` };
  return { kind: "invalid" };
}

// "677123456" -> "6 77 12 34 56"
export const formatNational = (national) =>
  String(national).replace(/^(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5");

// Affichage normalise : "+237 6 77 12 34 56" ; un numero etranger garde la saisie (nettoyee).
export function formatPhone(input) {
  const parsed = parsePhone(input);
  if (parsed.kind === "cm") return `+${CM_DIAL_CODE} ${formatNational(parsed.national)}`;
  if (parsed.kind === "intl") return String(input).trim().replace(/[^\d+\s]/g, "").replace(/\s+/g, " ");
  return String(input || "").trim();
}

// Code d'erreur (cle de traduction ui.phone.errors.*) ou null si la saisie est acceptable.
// mobileMoney : seul un numero mobile camerounais est accepte.
export function phoneError(input, { required = false, mobileMoney = false } = {}) {
  const parsed = parsePhone(input);
  if (parsed.kind === "empty") return required ? "required" : null;
  if (parsed.kind === "cm") return null;
  if (parsed.kind === "intl") return mobileMoney ? "mobileMoney" : null;
  return parsed.cm || mobileMoney ? "cm" : "invalid";
}

// Valeur a envoyer a l'API : E.164 ("+237677123456") si le numero est reconnu, sinon la saisie.
export function toE164(input) {
  const parsed = parsePhone(input);
  return parsed.e164 || String(input || "").trim();
}
