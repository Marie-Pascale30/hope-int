// Jetons signes (HMAC-SHA256) des liens envoyes par email : preferences et desinscription,
// confirmation d'inscription a la newsletter. Utilisables sans connexion, infalsifiables,
// limites a un usage (purpose) et, au besoin, a une duree.
//
// Format : base64url(JSON charge utile) "." base64url(HMAC). Cle : ENGAGEMENT_TOKEN_SECRET
// (32 caracteres minimum), sinon derivee de JWT_SECRET (changer JWT_SECRET invalide alors les liens).
const crypto = require("crypto");

function secret() {
    const configured = process.env.ENGAGEMENT_TOKEN_SECRET || "";
    if (configured.length >= 32) return configured;
    return crypto.createHmac("sha256", String(process.env.JWT_SECRET || "")).update("hope-engagement-links").digest("hex");
}

const b64 = (value) => Buffer.from(value).toString("base64url");

function signature(body) {
    return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

// purpose : usage du jeton ; data : champs courts (e = email, t = sujet, c = campagne) ;
// ttlSeconds : duree de validite (illimitee si absent).
function sign(purpose, data, { ttlSeconds } = {}) {
    const payload = { p: purpose, ...data };
    if (ttlSeconds) payload.x = Math.floor(Date.now() / 1000) + ttlSeconds;
    const body = b64(JSON.stringify(payload));
    return `${body}.${signature(body)}`;
}

// Renvoie la charge utile, ou null si le jeton est invalide, expire ou d'un autre usage.
function verify(token, purpose) {
    const [body, mac, extra] = String(token || "").split(".");
    if (!body || !mac || extra !== undefined || body.length > 2000) return null;
    const expected = Buffer.from(signature(body));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    let payload;
    try {
        payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch (_error) {
        return null;
    }
    if (!payload || payload.p !== purpose) return null;
    if (payload.x && payload.x < Math.floor(Date.now() / 1000)) return null;
    return payload;
}

module.exports = { sign, verify };
