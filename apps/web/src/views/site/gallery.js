// Photos du livret partenaires (catalogue @hope/shared/photos) preparees pour le site : ordre des
// albums, textes alternatifs et legendes traduits (messages site.gallery), selections par page
// et lecture du champ "gallery" des projets et actualites. Fonctions pures (testees).
import { PHOTO_ALBUMS, PHOTOS, PHOTOS_BY_ID } from "@hope/shared/photos";

// Ordre de la galerie : l'equipe en ouverture, puis les actions de la plus recente a la plus
// ancienne ; dans une annee, les albums dates d'abord (mois decroissant), puis les affiches.
export const GALLERY_ALBUMS = [...PHOTO_ALBUMS].sort((a, b) => {
  if (a.key === "equipe" || b.key === "equipe") return a.key === "equipe" ? -1 : 1;
  if (a.year !== b.year) return b.year - a.year;
  return (b.date || "").localeCompare(a.date || "");
});

export const GALLERY_YEARS = [...new Set(PHOTO_ALBUMS.map((album) => album.year))].sort((a, b) => b - a);

const ALBUMS_BY_KEY = Object.fromEntries(PHOTO_ALBUMS.map((album) => [album.key, album]));

// Rang de chaque photo dans son album (1, 2, 3...) pour le texte alternatif.
const RANK = Object.fromEntries(
  PHOTO_ALBUMS.flatMap((album) => album.photos.map(([id], index) => [id, index + 1]))
);
const PHOTOS_BY_SRC = Object.fromEntries(PHOTOS.map((photo) => [photo.src, photo]));

// Photos d'albums entiers (cle) ou isolees (identifiant), dans l'ordre des arguments, sans doublon.
export function selectPhotos(...refs) {
  const seen = new Set();
  const out = [];
  for (const ref of refs) {
    const list = ALBUMS_BY_KEY[ref] ? PHOTOS.filter((photo) => photo.album === ref) : [PHOTOS_BY_ID[ref]];
    for (const photo of list) {
      if (photo && !seen.has(photo.id)) {
        seen.add(photo.id);
        out.push(photo);
      }
    }
  }
  return out;
}

// Selection de l'accueil (section "En images").
export const HOME_PHOTOS = [
  "p11_00", "p13_09", "p06_02", "p14_11", "p05_03", "p24_05",
  "p18_03", "p09_05", "p20_07", "p16_06", "p25_10", "p08_10",
];

// Parcours de la page "Qui sommes-nous" : photos de chaque etape (cle de site.about.timeline.items),
// cover = photo de la carte. "who" : bloc de presentation (photo de l'equipe). Chaque album du
// livret est ainsi accessible depuis cette page.
export const ABOUT_PHOTOS = {
  who: { cover: "p03_12", refs: ["equipe"] },
  balessing: { cover: "p06_01", refs: ["rentree-2021-balessing"] },
  teachers: { cover: "p07_05", refs: ["enseignants-2022-douala"] },
  christmas2022: { cover: "p08_10", refs: ["noel-2022-yaounde", "noel-2022-douala"] },
  clothes: { refs: ["vetements-2022", "p10_01"] },
  women2023: { refs: ["p10_03"] },
  sickleCell: { refs: ["p10_02"] },
  dieuMerci: { cover: "p11_07", refs: ["rentree-2023-yaounde"] },
  christmas2023: { cover: "p12_12", refs: ["noel-2023-mere-teresa", "noel-2023-bonaberi", "noel-2023-bon-berger"] },
  women2024: { cover: "p17_01", refs: ["p15_02", "femmes-2024-yaounde", "femmes-2024-douala-irene", "femmes-2024-douala-armelle"] },
  street: { cover: "p19_03", refs: ["solidarite-rue-2024"] },
  school2024: { cover: "p21_08", refs: ["p15_04", "rentree-2024-yaounde", "rentree-2024-dschang"] },
  december2024: { refs: ["p15_00", "p15_03"] },
  women2025: { cover: "p23_02", refs: ["p22_03", "femmes-2025-yaounde"] },
  school2025: { cover: "p24_05", refs: ["p22_01", "rentree-2025-buisson-ardent", "rentree-2025-yaounde", "rentree-2025-dschang"] },
  aids2025: { refs: ["p22_02", "sida-2025"] },
};

// Date d'un album ("AAAA-MM") en toutes lettres, ou l'annee seule.
export function albumDate(album, f) {
  return album.date ? f.date(`${album.date}-15T12:00:00Z`, { month: "long", year: "numeric" }) : String(album.year);
}

// Texte alternatif d'une photo du catalogue (t : traducteur "site.gallery").
export function photoAlt(t, photo) {
  const title = t(`albums.${photo.album}.title`);
  const place = t(`albums.${photo.album}.place`);
  const index = RANK[photo.id] || 1;
  if (photo.kind === "logo") return t("alt.logo");
  if (photo.kind === "affiche") return t("alt.affiche", { poster: t(`posters.${photo.id}`) });
  if (photo.kind === "document") return t("alt.document", { title, place, index });
  return t("alt.photo", { title, place, index });
}

// Element affichable par PhotoGallery : { id, src, width, height, kind, alt, caption }.
export function galleryItem(t, f, photo) {
  const album = ALBUMS_BY_KEY[photo.album];
  return {
    id: photo.id,
    src: photo.src,
    width: photo.width,
    height: photo.height,
    kind: photo.kind,
    alt: photoAlt(t, photo),
    caption: t("caption", { title: t(`albums.${album.key}.title`), place: t(`albums.${album.key}.place`), date: albumDate(album, f) }),
  };
}

export const galleryItems = (t, f, photos) => photos.map((photo) => galleryItem(t, f, photo));

// Donnees de la page Galerie : tous les albums, toutes les photos.
export function galleryAlbums(t, f) {
  return GALLERY_ALBUMS.map((album) => ({
    key: album.key,
    year: album.year,
    title: t(`albums.${album.key}.title`),
    place: t(`albums.${album.key}.place`),
    date: albumDate(album, f),
    dateTime: album.date || String(album.year),
    caption: t(`albums.${album.key}.caption`),
    items: galleryItems(t, f, selectPhotos(album.key)),
  }));
}

// Champ "gallery" d'un projet ou d'une actualite : tableau, chaine JSON ou null.
export function parseGallery(value) {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.filter((entry) => entry && typeof entry.src === "string" && entry.src.trim());
}

// Galerie d'un contenu prete a afficher. Photo du livret : textes du catalogue ; autre image
// (upload) : "<titre du contenu> — photo n", dimensions par defaut (4/3) si absentes.
export function contentGallery(t, f, value, title) {
  return parseGallery(value).map((entry, index) => {
    const known = PHOTOS_BY_SRC[entry.src];
    if (known) return galleryItem(t, f, known);
    const width = Number(entry.width) > 0 ? Number(entry.width) : 800;
    const height = Number(entry.height) > 0 ? Number(entry.height) : 600;
    const alt = t("detail.photoAlt", { title, index: index + 1 });
    return { id: `${entry.src}-${index}`, src: entry.src, width, height, kind: entry.kind || "photo", alt, caption: alt };
  });
}
