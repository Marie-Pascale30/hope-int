// Coordonnees de l'association (repli si GET /meta est indisponible ou ancien) et normalisation
// de l'objet organization renvoye par l'API : tous les champs etendus (phones, poBox, president,
// mobileMoney) sont facultatifs. Module sans dependance : utilisable cote serveur comme client.

// Page Facebook officielle (surchargeable par NEXT_PUBLIC_SOCIAL_FACEBOOK).
export const FACEBOOK_URL = "https://web.facebook.com/Hopeinternationalcameroon";

export const ORGANIZATION_FALLBACK = {
  name: "HOPE International Project",
  email: "hopeinternationalproject@gmail.com",
  phone: "+237 694 63 25 60",
  phones: ["+237 694 63 25 60", "+237 699 94 33 29", "+237 677 86 57 43", "+237 699 91 33 77", "+237 679 53 55 10", "+1 630-597-5049"],
  address: "Bonadibong, Akwa, Douala — Cameroun",
  poBox: "12695",
  president: "Mabelle NZEMTCHOU FOTSO",
  mobileMoney: {
    mtn: "679 15 22 53",
    orangeUssd: "#150*47#",
    orangeMerchantCode: "747603",
    sara: "07881731101 26",
  },
};

const text = (value) => (typeof value === "string" ? value.trim() : "");

// Fusionne l'objet de l'API avec le repli : une valeur renseignee par l'API l'emporte toujours.
// Les telephones et Mobile Money de l'API remplacent en bloc ceux du repli (pas de melange).
export function withOrganizationDefaults(organization) {
  const org = organization && typeof organization === "object" ? organization : {};
  const fallback = ORGANIZATION_FALLBACK;
  const apiPhones = Array.isArray(org.phones) ? org.phones.map(text).filter(Boolean) : [];
  const phone = text(org.phone) || apiPhones[0] || fallback.phone;
  let phones = fallback.phones;
  if (apiPhones.length) phones = apiPhones;
  else if (text(org.phone)) phones = [phone];
  const apiMoney = org.mobileMoney && typeof org.mobileMoney === "object" ? org.mobileMoney : null;
  const money = apiMoney || fallback.mobileMoney;
  const mobileMoney = Object.fromEntries(
    ["mtn", "orangeUssd", "orangeMerchantCode", "sara"].map((key) => [key, text(money[key])]).filter(([, value]) => value)
  );
  return {
    name: text(org.name) || fallback.name,
    email: text(org.email) || fallback.email,
    phone,
    phones,
    address: text(org.address) || fallback.address,
    poBox: poBoxNumber(org.poBox) || fallback.poBox,
    president: text(org.president) || fallback.president,
    mobileMoney,
  };
}

// "B.P. 12695", "BP 12695", "P.O. Box 12695" -> "12695" (le libelle est traduit a l'affichage).
export function poBoxNumber(value) {
  return text(value).replace(/^(b\.?\s*p\.?|p\.?\s*o\.?\s*box)\s*:?\s*/i, "");
}

// Lien tel: a partir d'un numero affiche ("+237 694 63 25 60" -> "tel:+237694632560").
export const telHref = (value) => `tel:${String(value).replace(/[^\d+]/g, "")}`;
