// Justificatifs des dons hors ligne : image (JPG, PNG, WebP) ou PDF de 5 Mo maximum, type verifie
// par sa signature binaire (le type MIME declare n'est pas fiable). Le fichier reste en memoire puis
// en base : il n'est jamais servi par /uploads (lecture authentifiee uniquement).
const multer = require("multer");
const { detectImageType } = require("../utils/uploads");

const PROOF_FORMAT_ERROR = "Justificatif : formats acceptés JPG, PNG, WebP ou PDF (5 Mo maximum)";

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function detectProofType(buffer) {
    if (!Buffer.isBuffer(buffer)) return null;
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") return { ext: ".pdf", mime: "application/pdf" };
    const image = detectImageType(buffer);
    // GIF exclu : un justificatif est une photo, un scan ou un PDF.
    return image && image.mime !== "image/gif" ? image : null;
}

// Nom de fichier affiche (Content-Disposition) : caracteres surs uniquement.
function safeName(original, ext) {
    const base = String(original || "justificatif")
        .replace(/\.[^.]*$/, "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "justificatif";
    return `${base}${ext}`;
}

// Middleware : champ "proof" facultatif ; req.proof = { buffer, mime, name } si present et valide.
function proofUpload(field = "proof") {
    const parse = memoryUpload.single(field);
    return (req, res, next) => {
        parse(req, res, (error) => {
            if (error) {
                if (error instanceof multer.MulterError) return next(Object.assign(new Error(PROOF_FORMAT_ERROR), { status: 400 }));
                return next(error);
            }
            if (!req.file) return next();
            const type = detectProofType(req.file.buffer);
            if (!type) return next(Object.assign(new Error(PROOF_FORMAT_ERROR), { status: 400 }));
            // Multer lit le nom du fichier en latin1 : on le relit en UTF-8.
            const original = Buffer.from(String(req.file.originalname || ""), "latin1").toString("utf8");
            req.proof = { buffer: req.file.buffer, mime: type.mime, name: safeName(original, type.ext) };
            return next();
        });
    };
}

module.exports = { proofUpload, detectProofType, safeName, PROOF_FORMAT_ERROR };
