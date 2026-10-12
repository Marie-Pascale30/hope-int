// Options d'un don au-dela du montant : source (?ref=), hommage, engagement Mobile Money et
// collecte personnelle. Nettoyage et controles des saisies du donateur (texte brut, longueurs
// bornees, aucune balise ni lien dans les textes repris dans les emails).
const { TRIBUTE_TYPES, TRIBUTE_LIMITS, cleanSource } = require("@hope/shared/fundraising");
const { badRequest } = require("../utils/httpError");

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

// Texte d'une ligne : caracteres de controle, chevrons et caracteres hors plan de base retires
// (les polices PDF standard ne les impriment pas), espaces reduits.
function singleLine(value, max) {
    return String(value ?? "")
        .normalize("NFC")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f-\u009f<>]/g, " ")
        .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
        .trim();
}

// Message court : retours a la ligne conserves (2 au plus d'affilee), liens neutralises pour qu'un
// email envoye par l'association ne serve pas de relais a un lien arbitraire.
function shortMessage(value, max) {
    return String(value ?? "")
        .normalize("NFC")
        .replace(/\r\n?/g, "\n")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f<>]/g, " ")
        .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
        .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[lien retiré]")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max)
        .trim();
}

function isEmail(value) {
    return typeof value === "string" && value.length <= TRIBUTE_LIMITS.email && EMAIL_PATTERN.test(value);
}

// Hommage facultatif : { tributeType, tributeName, tributeEmail, tributeMessage } ou {}.
function parseTribute(input = {}) {
    if (!input.tributeType) return {};
    if (!TRIBUTE_TYPES.includes(input.tributeType)) throw badRequest("Type d'hommage invalide");
    const tributeName = singleLine(input.tributeName, TRIBUTE_LIMITS.name);
    if (tributeName.length < 2) throw badRequest("Indiquez le nom de la personne honorée");
    const email = String(input.tributeEmail || "").trim().toLowerCase();
    if (email && !isEmail(email)) throw badRequest("Email du proche à prévenir invalide");
    const tributeMessage = shortMessage(input.tributeMessage, TRIBUTE_LIMITS.message);
    return {
        tributeType: input.tributeType,
        tributeName,
        tributeEmail: email || null,
        tributeMessage: tributeMessage || null,
    };
}

module.exports = { cleanSource, parseTribute, singleLine, shortMessage, isEmail };
