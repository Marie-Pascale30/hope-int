// Chargement des dictionnaires : un dossier par langue, un fichier par espace de noms.
//
//   common.json  -> habillage partage : common, nav, theme, footer, language, errors
//   site.json    -> { "site": { ... } }     site public (accueil, projets, agenda...)
//   account.json -> { "account": { ... } } dons, connexion, espace membre
//   admin.json   -> { "admin": { ... } }   back-office : habillage, tableau de bord, membres,
//                                           candidatures, messages, roles, regional, systeme
//   adminOps.json -> { "adminOps": { ... } } back-office : dons, finance, rapport, contenus,
//                                           evenements, journal
//
// Chaque fichier possede ses cles de premier niveau : deux fichiers ne doivent jamais
// declarer la meme (verifie au chargement). Une cle absente dans une langue retombe
// sur le francais, langue de reference.
import { DEFAULT_LOCALE, isLocale } from "../config";

export const MESSAGE_FILES = ["common", "site", "account", "admin", "adminOps"];

const loaders = {
  fr: {
    common: () => import("./fr/common.json"),
    site: () => import("./fr/site.json"),
    account: () => import("./fr/account.json"),
    admin: () => import("./fr/admin.json"),
    adminOps: () => import("./fr/adminOps.json"),
  },
  en: {
    common: () => import("./en/common.json"),
    site: () => import("./en/site.json"),
    account: () => import("./en/account.json"),
    admin: () => import("./en/admin.json"),
    adminOps: () => import("./en/adminOps.json"),
  },
  es: {
    common: () => import("./es/common.json"),
    site: () => import("./es/site.json"),
    account: () => import("./es/account.json"),
    admin: () => import("./es/admin.json"),
    adminOps: () => import("./es/adminOps.json"),
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
