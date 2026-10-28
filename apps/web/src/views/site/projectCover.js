// Visuel de repli d'un projet sans image (ou dont l'image est une ancienne illustration SVG) :
// une vraie photo du livret, jamais une affiche, un document ou un logo. Ordre de choix :
// 1. premiere photo de terrain de la galerie du projet ;
// 2. photo du theme du projet (mots-cles du titre, du resume et de la description) ;
// 3. photo generique de l'association.
// Dans une liste de photos, le choix depend de l'identifiant du projet : deux projets voisins
// d'une grille n'affichent pas la meme photo, et un projet garde toujours la sienne.
// Fonctions pures (testees).
import { PHOTOS, photoUrl } from "@hope/shared/photos";
import { parseGallery } from "./gallery";

// Anciennes illustrations des projets (/images/projects/<theme>.svg, premieres donnees de
// demonstration) : traitees comme une absence d'image, leur nom indique le theme.
const LEGACY_ILLUSTRATION = /^\/images\/projects\/([\w-]+)\.svg$/i;
const LEGACY_THEMES = { microcredit: "femmes", formation: "education", agriculture: "agriculture", eau: "eau", sante: "sante" };

export function isLegacyIllustration(url) {
  return typeof url === "string" && LEGACY_ILLUSTRATION.test(url.trim().split("?")[0]);
}

// Photos par theme : [identifiant, cadrage (object-position) si le centre coupe les visages].
// L'ordre des themes departage les egalites (ex. "Epargne et sante" : sante).
export const PROJECT_THEMES = [
  {
    key: "noel",
    keywords: ["noel", "orphelin", "jouet", "fete", "cadeau", "friandise"],
    photos: [["p14_11"], ["p08_10"], ["p13_09"], ["p09_05"]],
  },
  {
    key: "sante",
    keywords: ["sante", "sida", "vih", "drepanocytose", "depistage", "medic", "soin", "infirmerie", "maladie", "nutrition", "hepatite", "cancer"],
    photos: [["p13_05", "50% 25%"], ["p12_08", "50% 20%"], ["p08_09"]],
  },
  {
    key: "eau",
    keywords: ["eau", "puits", "forage", "potable", "assainissement", "hygiene"],
    photos: [["p21_02"], ["p20_04", "50% 40%"]],
  },
  {
    key: "agriculture",
    keywords: ["agricol", "agricult", "agro", "champ", "ferme", "recolte", "elevage", "semence", "maraich", "plantation", "cacao"],
    photos: [["p16_06"], ["p21_02"], ["p20_04", "50% 40%"]],
  },
  {
    key: "femmes",
    keywords: ["femme", "mere", "microcredit", "credit", "epargne", "entrepreneu", "commerce", "couture", "coiffure", "autonomisation", "activite generatrice"],
    photos: [["p16_06"], ["p23_05"], ["p18_03"], ["p17_01", "50% 30%"]],
  },
  {
    key: "education",
    keywords: ["educat", "ecole", "scolar", "scolaire", "rentree", "fourniture", "eleve", "parrain", "enseign", "bibliotheque", "academie", "formation", "apprenti", "etude"],
    photos: [["p20_09"], ["p11_00"], ["p06_02", "50% 30%"], ["p24_10"], ["p20_03"], ["p25_09"]],
  },
  {
    key: "social",
    keywords: ["vetement", "habit", "rue", "sans-abri", "refugie", "prison", "repas", "colis", "vivres", "alimentaire", "vulnerable"],
    photos: [["p14_05"], ["p12_10"], ["p13_07"]],
  },
];

// Photos de l'association quand aucun theme ne ressort.
export const DEFAULT_PHOTOS = [["p11_00"], ["p13_09"], ["p20_03"], ["p05_03"], ["p14_11"], ["p25_02"]];

const PHOTOS_BY_SRC = Object.fromEntries(PHOTOS.map((photo) => [photo.src, photo]));
const THEMES_BY_KEY =Object.fromEntries(PROJECT_THEMES.map((theme) => [theme.key, theme]));

// Minuscules sans accents, pour comparer les mots-cles.
const normalize = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Mot-cle en debut de mot ("eau" ne reconnait ni "nouveau" ni "beaute", "rue" ni "cruel").
const KEYWORD_PATTERNS = Object.fromEntries(
  PROJECT_THEMES.map((theme) => [theme.key, theme.keywords.map((word) => new RegExp(`(^|[^a-z])${escapeRegExp(word)}`, "g"))])
);

const countHits = (text, patterns) => patterns.reduce((total, pattern) => total + (text.match(pattern) || []).length, 0);

// Theme d'un projet : le titre compte triple ; ancienne illustration SVG prioritaire ; null sinon.
export function projectTheme(project) {
  const legacy = LEGACY_ILLUSTRATION.exec(String(project?.image_url || "").trim().split("?")[0]);
  if (legacy && LEGACY_THEMES[legacy[1].toLowerCase()]) return LEGACY_THEMES[legacy[1].toLowerCase()];
  const title = normalize(project?.title);
  const body = normalize(`${project?.summary || ""} ${project?.description || ""}`);
  let best = null;
  let bestScore = 0;
  for (const theme of PROJECT_THEMES) {
    const patterns = KEYWORD_PATTERNS[theme.key];
    const score = countHits(title, patterns) * 3 + countHits(body, patterns);
    if (score > bestScore) {
      best = theme.key;
      bestScore = score;
    }
  }
  return best;
}

// Indice stable a partir de l'identifiant (ou du titre a defaut).
function stableIndex(project, length) {
  const id = Number(project?.id);
  if (Number.isInteger(id) && id >= 0) return id % length;
  let hash = 0;
  for (const char of String(project?.title || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

// Premiere photo de terrain de la galerie (photo du livret de type "photo", ou image televersee).
function galleryCover(project) {
  for (const entry of parseGallery(project?.gallery)) {
    const known = PHOTOS_BY_SRC[entry.src];
    if (known ? known.kind === "photo" : !entry.kind || entry.kind === "photo") return { src: entry.src };
  }
  return null;
}

// Photo de repli d'un projet : { src, position? }.
export function projectFallbackPhoto(project) {
  const fromGallery = galleryCover(project);
  if (fromGallery) return fromGallery;
  const list = THEMES_BY_KEY[projectTheme(project)]?.photos || DEFAULT_PHOTOS;
  const [id, position] = list[stableIndex(project, list.length)];
  return position ? { src: photoUrl(id), position } : { src: photoUrl(id) };
}
