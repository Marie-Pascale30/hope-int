// Parametres d'URL de la page /don (liens de relance, d'engagement, de collecte et de partage) :
// lecture defensive, aucune valeur n'est reprise sans controle. Fonctions pures (testees).
import { cleanSource } from "@hope/shared/fundraising";

const SOURCE_STORAGE_KEY = "hope_don_ref";

// "25", "25.5", "10000" -> nombre positif, sinon null.
function readAmount(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return amount > 0 ? amount : null;
}

// searchParams : URLSearchParams (ou objet { get }).
export function parseDonateParams(searchParams) {
  const get = (key) => searchParams?.get?.(key) ?? null;
  const moyen = get("moyen");
  const devise = get("devise");
  const method = moyen === "mobile_money" || moyen === "card"
    ? moyen
    : devise === "xaf" ? "mobile_money" : devise === "eur" ? "card" : null;
  const fundraiser = get("collecte");
  const pledgeRef = get("engagement");
  return {
    amount: readAmount(get("montant")),
    method,
    frequency: get("frequence") === "monthly" ? "monthly" : null,
    projectId: /^\d{1,9}$/.test(get("projet") || "") ? get("projet") : null,
    source: cleanSource(get("ref") || ""),
    fundraiser: /^[a-z0-9-]{3,80}$/.test(fundraiser || "") ? fundraiser : null,
    pledgeRef: /^[a-f0-9]{24}$/.test(pledgeRef || "") ? pledgeRef : null,
  };
}

// La source survit a un detour (connexion, changement de langue) le temps de la visite.
export function rememberSource(source) {
  if (typeof window === "undefined") return source || null;
  try {
    if (source) window.sessionStorage.setItem(SOURCE_STORAGE_KEY, source);
    return source || cleanSource(window.sessionStorage.getItem(SOURCE_STORAGE_KEY) || "");
  } catch {
    return source || null;
  }
}

// Lien de don avec la source de partage (ex. depuis la page de remerciement ou d'une collecte).
export function donatePath({ projectId, fundraiser, source } = {}) {
  const params = new URLSearchParams();
  if (projectId) params.set("projet", String(projectId));
  if (fundraiser) params.set("collecte", fundraiser);
  if (source) params.set("ref", source);
  const query = params.toString();
  return query ? `/don?${query}` : "/don";
}
