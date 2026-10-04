const fs = require("fs");
const path = require("path");

// Dossier servi sous /uploads par app.js (relatif au repertoire de lancement de l'API).
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const PUBLIC_PREFIX = "/uploads/";

// Type reel d'une image d'apres sa signature binaire (le MIME declare n'est pas fiable).
// SVG exclu volontairement : il peut embarquer du script.
const SIGNATURES = [
    { ext: ".jpg", mime: "image/jpeg", test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    {
        ext: ".png",
        mime: "image/png",
        test: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    },
    {
        ext: ".gif",
        mime: "image/gif",
        test: (b) => b.length >= 6 && ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("latin1")),
    },
    {
        ext: ".webp",
        mime: "image/webp",
        test: (b) => b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
    },
];

function detectImageType(buffer) {
    if (!Buffer.isBuffer(buffer)) return null;
    const match = SIGNATURES.find((signature) => signature.test(buffer));
    return match ? { ext: match.ext, mime: match.mime } : null;
}

// Chemin disque d'une URL /uploads/<fichier>, ou null si elle sort du dossier uploads
// (garde-fou : aucune suppression ailleurs, meme avec une URL forgee).
function resolveUploadPath(imageUrl) {
    if (typeof imageUrl !== "string" || !imageUrl.startsWith(PUBLIC_PREFIX)) return null;
    const name = imageUrl.slice(PUBLIC_PREFIX.length);
    if (!name || name !== path.basename(name) || name.startsWith(".")) return null;
    const full = path.resolve(UPLOADS_DIR, name);
    if (path.dirname(full) !== UPLOADS_DIR) return null;
    return full;
}

// Suppression best-effort : un fichier deja absent n'est pas une erreur.
async function removeUpload(imageUrl) {
    const full = resolveUploadPath(imageUrl);
    if (!full) return false;
    try {
        await fs.promises.unlink(full);
        return true;
    } catch (error) {
        if (error.code !== "ENOENT") console.error("upload-cleanup-error:", error.message);
        return false;
    }
}

// Apres une mise a jour : supprime l'ancienne image si elle a ete remplacee ou retiree.
async function removeReplacedUpload(previousUrl, nextUrl) {
    if (previousUrl && previousUrl !== nextUrl) await removeUpload(previousUrl);
}

module.exports = { UPLOADS_DIR, PUBLIC_PREFIX, detectImageType, resolveUploadPath, removeUpload, removeReplacedUpload };
