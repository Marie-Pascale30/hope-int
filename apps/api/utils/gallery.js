// Galeries photos des projets et actualites (colonne JSON gallery) : liste ordonnee de
// { src, width?, height?, kind? }. src : chemin du site (/images/... photos du livret) ou image
// envoyee (/uploads/...). Pas d'URL externe : next/image ne sert que les domaines autorises.
const GALLERY_MAX = 200;
const GALLERY_KINDS = ["photo", "affiche", "document", "logo"];
const SRC_MAX = 500;
const DIMENSION_MAX = 20000;

// Chemin relatif sur : /images/... ou /uploads/..., caracteres simples, sans "..", "//" ni "\".
const SRC_PATTERN = /^\/(images|uploads)\/[A-Za-z0-9._\-/]+$/;

function isGallerySrc(src) {
    return typeof src === "string"
        && src.length <= SRC_MAX
        && SRC_PATTERN.test(src)
        && !src.includes("..")
        && !src.includes("//");
}

function invalid(message) {
    const error = new Error(message);
    error.galleryInvalid = true;
    return error;
}

const isDimension = (value) => Number.isInteger(value) && value >= 1 && value <= DIMENSION_MAX;

// Dimension optionnelle : absente / vide -> undefined ; texte numerique accepte (formulaires).
function readDimension(value, name, index) {
    if (value === undefined || value === null || value === "") return undefined;
    const number = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
    if (!isDimension(number)) throw invalid(`Galerie : ${name} invalide (photo ${index + 1})`);
    return number;
}

// Lecture d'une galerie envoyee par le client (tableau, ou chaine JSON en multipart).
// Renvoie un tableau normalise (champs connus uniquement) ou null (galerie vide / retiree) ;
// leve une erreur (message en francais) si le format est invalide.
function parseGalleryInput(value) {
    if (value === undefined || value === null || value === "") return null;
    let list = value;
    if (typeof list === "string") {
        try {
            list = JSON.parse(list);
        } catch {
            throw invalid("Galerie : JSON invalide");
        }
    }
    if (list === null) return null;
    if (!Array.isArray(list)) throw invalid("Galerie : une liste de photos est attendue");
    if (list.length > GALLERY_MAX) throw invalid(`Galerie : ${GALLERY_MAX} photos au maximum`);
    const out = list.map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw invalid(`Galerie : photo ${index + 1} invalide`);
        }
        if (!isGallerySrc(entry.src)) throw invalid(`Galerie : adresse de la photo ${index + 1} invalide`);
        const photo = { src: entry.src };
        const width = readDimension(entry.width, "largeur", index);
        const height = readDimension(entry.height, "hauteur", index);
        if (width !== undefined) photo.width = width;
        if (height !== undefined) photo.height = height;
        if (entry.kind !== undefined && entry.kind !== null && entry.kind !== "") {
            if (!GALLERY_KINDS.includes(entry.kind)) throw invalid(`Galerie : type de la photo ${index + 1} invalide`);
            photo.kind = entry.kind;
        }
        return photo;
    });
    return out.length ? out : null;
}

// Lecture en base : mysql2 renvoie la colonne JSON deja analysee (ou une chaine selon le
// pilote) ; toujours un tableau d'entrees valides, ou null.
function readGallery(value) {
    let list = value;
    if (list === undefined || list === null) return null;
    if (Buffer.isBuffer(list)) list = list.toString("utf8");
    if (typeof list === "string") {
        try {
            list = JSON.parse(list);
        } catch {
            return null;
        }
    }
    if (!Array.isArray(list)) return null;
    const valid = list.filter((entry) => entry && typeof entry === "object" && typeof entry.src === "string" && entry.src);
    return valid.length ? valid : null;
}

// Images envoyees (/uploads) d'une galerie.
function galleryUploads(gallery) {
    return (readGallery(gallery) || []).map((entry) => entry.src).filter((src) => src.startsWith("/uploads/"));
}

module.exports = { GALLERY_MAX, GALLERY_KINDS, isGallerySrc, parseGalleryInput, readGallery, galleryUploads };
