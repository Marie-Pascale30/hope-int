// Fichiers de la transparence financiere :
// - justificatifs de depenses (PDF ou images) : dossier PRIVE, hors de /uploads (servi
//   publiquement par app.js), lus uniquement via une route authentifiee de la finance ;
// - documents publics (rapports annuels en PDF) : dossier public /uploads.
// Comme middlewares/uploadMiddleware : fichier garde en memoire le temps de verifier sa
// signature binaire (le type MIME declare n'est pas fiable), rien n'est ecrit sinon.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { UPLOADS_DIR, detectImageType, removeUpload } = require("../utils/uploads");
const { badRequest } = require("../utils/httpError");

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const RECEIPT_FORMAT_ERROR = "Justificatif : PDF, JPG, PNG, WebP ou GIF uniquement";
const DOCUMENT_FORMAT_ERROR = "Document : PDF uniquement";
const FILE_TOO_LARGE = "Fichier trop lourd (10 Mo maximum)";

// Dossier prive des justificatifs (PRIVATE_UPLOADS_DIR, relatif au repertoire de lancement).
// Lu a chaque appel : les tests le redirigent vers un dossier temporaire.
function privateDir() {
    return path.resolve(process.cwd(), process.env.PRIVATE_UPLOADS_DIR || "private-uploads", "expenses");
}

// "%PDF-" en tete de fichier (signature des PDF).
function isPdf(buffer) {
    return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

function detectFileType(buffer, { allowImages }) {
    if (isPdf(buffer)) return { ext: ".pdf", mime: "application/pdf" };
    return allowImages ? detectImageType(buffer) : null;
}

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

function randomName(ext) {
    return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
}

// Chemin disque d'un justificatif d'apres son nom stocke (garde-fou contre "../").
function resolveReceipt(name) {
    if (typeof name !== "string" || !name || name !== path.basename(name) || name.startsWith(".")) return null;
    const dir = privateDir();
    const full = path.resolve(dir, name);
    return path.dirname(full) === dir ? full : null;
}

async function removeReceipt(name) {
    const full = resolveReceipt(name);
    if (!full) return false;
    try {
        await fs.promises.unlink(full);
        return true;
    } catch (error) {
        if (error.code !== "ENOENT") console.error("receipt-cleanup-error:", error.message);
        return false;
    }
}

// Middleware multipart : champ `field`, verifie et ecrit le fichier, puis expose
// req.storedFile = { name | url, mime, size, originalName }. En cas d'echec de la requete
// (validation, droits), le fichier ecrit est supprime.
function upload(field, { visibility }) {
    const parse = memoryUpload.single(field);
    const allowImages = visibility === "private";
    return (req, res, next) => {
        parse(req, res, async (error) => {
            if (error) {
                if (error instanceof multer.MulterError) {
                    return next(badRequest(error.code === "LIMIT_FILE_SIZE" ? FILE_TOO_LARGE : "Fichier refusé"));
                }
                return next(error);
            }
            const file = req.file;
            if (!file) return next();
            const type = detectFileType(file.buffer, { allowImages });
            if (!type) return next(badRequest(allowImages ? RECEIPT_FORMAT_ERROR : DOCUMENT_FORMAT_ERROR));
            try {
                const name = randomName(type.ext);
                const dir = visibility === "private" ? privateDir() : UPLOADS_DIR;
                await fs.promises.mkdir(dir, { recursive: true });
                await fs.promises.writeFile(path.join(dir, name), file.buffer);
                req.storedFile = {
                    name,
                    url: visibility === "public" ? `/uploads/${name}` : null,
                    mime: type.mime,
                    size: file.size,
                    // Nom d'origine conserve pour le telechargement (caracteres surs uniquement).
                    originalName: String(file.originalname || "").replace(/[^\w.\- ]+/g, "_").slice(0, 200) || name,
                };
                delete file.buffer;
                res.on("finish", () => {
                    if (res.statusCode < 400) return;
                    if (visibility === "private") removeReceipt(name);
                    else removeUpload(`/uploads/${name}`);
                });
                next();
            } catch (writeError) {
                next(writeError);
            }
        });
    };
}

module.exports = {
    uploadReceipt: (field = "receipt") => upload(field, { visibility: "private" }),
    uploadPublicDocument: (field = "file") => upload(field, { visibility: "public" }),
    resolveReceipt,
    removeReceipt,
    isPdf,
    detectFileType,
    privateDir,
    MAX_FILE_BYTES,
    RECEIPT_FORMAT_ERROR,
    DOCUMENT_FORMAT_ERROR,
    FILE_TOO_LARGE,
};
