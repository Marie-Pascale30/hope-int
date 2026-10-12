// TOTP (RFC 6238, HOTP RFC 4226) avec le module crypto natif : HMAC-SHA1, 6 chiffres, pas de 30 s.
// Secrets chiffres au repos (AES-256-GCM, cle TOTP_ENCRYPTION_KEY).
const crypto = require("crypto");
const { TOTP } = require("@hope/shared/engagement");

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = "";
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
    return output;
}

function base32Decode(text) {
    const clean = String(text || "").toUpperCase().replace(/[\s=-]/g, "");
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const char of clean) {
        const index = BASE32.indexOf(char);
        if (index === -1) throw new Error("base32 invalide");
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

function hotp(secret, counter, digits = TOTP.digits) {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac("sha1", secret).update(message).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
    return String(binary % 10 ** digits).padStart(digits, "0");
}

const stepAt = (timeMs = Date.now()) => Math.floor(timeMs / 1000 / TOTP.period);

function generate(secret, timeMs = Date.now()) {
    return hotp(secret, stepAt(timeMs));
}

// Renvoie le pas de temps correspondant au code (fenetre +/- window pas), ou null.
// Comparaison a temps constant pour chaque pas teste.
function verify(secret, code, { timeMs = Date.now(), window = TOTP.window } = {}) {
    const value = String(code || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(value)) return null;
    const current = stepAt(timeMs);
    let matched = null;
    for (let delta = -window; delta <= window; delta += 1) {
        const expected = Buffer.from(hotp(secret, current + delta));
        if (crypto.timingSafeEqual(expected, Buffer.from(value)) && matched === null) matched = current + delta;
    }
    return matched;
}

const newSecret = () => crypto.randomBytes(20);

function otpauthUrl({ secret, account, issuer }) {
    const label = encodeURIComponent(`${issuer}:${account}`);
    const params = new URLSearchParams({ secret: base32Encode(secret), issuer, algorithm: TOTP.algorithm, digits: String(TOTP.digits), period: String(TOTP.period) });
    return `otpauth://totp/${label}?${params.toString()}`;
}

// --- Chiffrement du secret ---

function encryptionKey() {
    const raw = process.env.TOTP_ENCRYPTION_KEY || "";
    if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
    if (raw) {
        const decoded = Buffer.from(raw, "base64");
        if (decoded.length === 32) return decoded;
    }
    if (process.env.NODE_ENV === "production") {
        const error = new Error("TOTP_ENCRYPTION_KEY manquante ou invalide (32 octets en hexadécimal ou base64)");
        error.status = 503;
        throw error;
    }
    // Developpement et tests : cle derivee de JWT_SECRET (a ne pas utiliser en production).
    return crypto.createHash("sha256").update(`totp:${process.env.JWT_SECRET || "dev"}`).digest();
}

const isKeyConfigured = () => {
    try {
        const raw = process.env.TOTP_ENCRYPTION_KEY || "";
        return /^[0-9a-f]{64}$/i.test(raw) || Boolean(raw && Buffer.from(raw, "base64").length === 32);
    } catch (_error) {
        return false;
    }
};

function encryptSecret(secret) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptSecret(value) {
    const [version, iv, tag, data] = String(value || "").split(":");
    if (version !== "v1") throw new Error("Format de secret inconnu");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]);
}

module.exports = {
    base32Encode,
    base32Decode,
    hotp,
    generate,
    verify,
    stepAt,
    newSecret,
    otpauthUrl,
    encryptSecret,
    decryptSecret,
    isKeyConfigured,
};
