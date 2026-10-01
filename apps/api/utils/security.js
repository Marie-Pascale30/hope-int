const crypto = require("crypto");

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3001").replace(/\/$/, "");

// 8 caracteres minimum, au moins une lettre et un chiffre.
function assertStrongPassword(password) {
    const value = String(password || "");
    if (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
        const error = new Error("Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
        error.status = 400;
        throw error;
    }
}

function generateTempPassword() {
    // Garantit lettre + chiffre pour respecter la politique ci-dessus.
    return `${crypto.randomBytes(6).toString("base64url")}a${crypto.randomInt(10, 99)}`;
}

const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("hex");
const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

module.exports = { FRONTEND_URL, assertStrongPassword, generateTempPassword, randomToken, sha256 };
