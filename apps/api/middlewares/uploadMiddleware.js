const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { UPLOADS_DIR, detectImageType, removeUpload } = require("../utils/uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const FORMAT_ERROR = "Formats acceptés : JPG, PNG, WebP ou GIF";

function formatError() {
    const error = new Error(FORMAT_ERROR);
    error.status = 400;
    return error;
}

// Le fichier reste en memoire (5 Mo max) le temps de verifier sa signature binaire :
// rien n'est ecrit sur le disque tant que le type reel n'est pas une image autorisee.
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Si la requete echoue ensuite (validation, droits, erreur metier), le fichier ecrit est supprime.
function cleanupOnFailure(req, res) {
    res.on("finish", () => {
        if (res.statusCode >= 400 && req.file?.filename) {
            removeUpload(`/uploads/${req.file.filename}`);
        }
    });
}

async function persist(req) {
    const file = req.file;
    if (!file) return;
    const type = detectImageType(file.buffer);
    if (!type) throw formatError();

    const filename = `${Date.now()}-${crypto.randomInt(1e9)}${type.ext}`;
    const destination = path.join(UPLOADS_DIR, filename);
    await fs.promises.writeFile(destination, file.buffer);

    file.mimetype = type.mime;
    file.filename = filename;
    file.destination = UPLOADS_DIR;
    file.path = destination;
    delete file.buffer;
}

// Meme usage qu'avant : upload.single("image").
function single(field) {
    const parse = memoryUpload.single(field);
    return (req, res, next) => {
        parse(req, res, (error) => {
            if (error) return next(error);
            cleanupOnFailure(req, res);
            persist(req).then(() => next(), next);
        });
    };
}

module.exports = { single, FORMAT_ERROR };
