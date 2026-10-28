// Chargement des dictionnaires : un dossier par langue, un fichier par espace de noms.
//
//   common.json  -> habillage partage : common, nav, theme, footer, language, errors
//   site.json    -> { "site": { ... } }     site public (accueil, projets, agenda...)
//   account.json -> { "account": { ... } } dons, connexion, espace membre
//   admin.json   -> { "admin": { ... } }   back-office : habillage, tableau de bord, membres,
//                                           candidatures, messages, roles, regional, systeme
//   fundraising / engagement / volunteering / transparency .json -> modules fonctionnels
//                 (dons etendus ; RGPD, CRM, newsletter ; benevolat ; transparence), une racine chacun
//   adminOps.json -> { "adminOps": { ... } } back-office : dons, finance, rapport, contenus,
//                                           evenements, journal
//   legal.json   -> { "legal": { ... } }   mentions legales et politique de confidentialite (rendu
//                                           serveur ; seul legal.links est envoye au navigateur)
//
// Chaque fichier possede ses cles de premier niveau : deux fichiers ne doivent jamais
// declarer la meme (verifie au chargement). Une cle absente dans une langue retombe
// sur le francais, langue de reference.
import { DEFAULT_LOCALE, isLocale } from "../config";

// Modules fonctionnels : charges a la fois par le site et par le back-office.
export const FEATURE_FILES = ["fundraising","engagement","volunteering","transparency"];

export const MESSAGE_FILES = ["common", "site", "account", "admin", "adminOps", "legal", ...FEATURE_FILES];

const loaders = {
  fr: {
    common: () => import("./fr/common.json"),
    site: () => import("./fr/site.json"),
    account: () => import("./fr/account.json"),
    admin: () => import("./fr/admin.json"),
    adminOps: () => import("./fr/adminOps.json"),
    fundraising: () => import("./fr/fundraising.json"),
    engagement: () => import("./fr/engagement.json"),
    volunteering: () => import("./fr/volunteering.json"),
    transparency: () => import("./fr/transparency.json"),
    legal: () => import("./fr/legal.json"),
  },
  en: {
    common: () => import("./en/common.json"),
    site: () => import("./en/site.json"),
    account: () => import("./en/account.json"),
    admin: () => import("./en/admin.json"),
    adminOps: () => import("./en/adminOps.json"),
    fundraising: () => import("./en/fundraising.json"),
    engagement: () => import("./en/engagement.json"),
    volunteering: () => import("./en/volunteering.json"),
    transparency: () => import("./en/transparency.json"),
    legal: () => import("./en/legal.json"),
  },
  es: {
    common: () => import("./es/common.json"),
    site: () => import("./es/site.json"),
    account: () => import("./es/account.json"),
    admin: () => import("./es/admin.json"),
    adminOps: () => import("./es/adminOps.json"),
    fundraising: () => import("./es/fundraising.json"),
    engagement: () => import("./es/engagement.json"),
    volunteering: () => import("./es/volunteering.json"),
    transparency: () => import("./es/transparency.json"),
    legal: () => import("./es/legal.json"),
  },
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

// Fusion profonde : les valeurs de `override` remplacent celles de `base`.
function deepMerge(base, override) {
  const result = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    result[key] = isObject(value) && isObject(base?.[key]) ? deepMerge(base[key], value) : value;
  });
  return result;
}

async function loadFiles(locale, files) {
  const entries = await Promise.all(
    files.map(async (file) => [file, (await loaders[locale][file]()).default || {}])
  );
  return Object.fromEntries(entries);
}

function combine(byFile) {
  const merged = {};
  const owners = {};
  Object.entries(byFile).forEach(([file, content]) => {
    Object.keys(content).forEach((key) => {
      if (owners[key] && owners[key] !== file) {
        throw new Error(`[i18n] La cle "${key}" est declaree dans ${owners[key]}.json et ${file}.json`);
      }
      owners[key] = file;
      merged[key] = content[key];
    });
  });
  return merged;
}

// Messages d'une langue (fichiers choisis), completes par le francais.
export async function loadMessages(locale, files = MESSAGE_FILES) {
  const target = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const reference = combine(await loadFiles(DEFAULT_LOCALE, files));
  if (target === DEFAULT_LOCALE) return reference;
  return deepMerge(reference, combine(await loadFiles(target, files)));
}
