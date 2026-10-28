// Cookie "appareil de confiance" (double authentification par email des comptes de l'equipe) :
// jeton aleatoire opaque, httpOnly, envoye seulement aux routes /api/auth. Seule son empreinte
// est stockee (table trusted_devices) ; le jeton n'a de valeur que pour le compte qui l'a obtenu.
// Memes attributs que le cookie de session (config/session.js : SameSite, Secure, domaine).
const DEVICE_COOKIE = "hope_device";
const DEVICE_TTL_DAYS = 30;

const isProduction = process.env.NODE_ENV === "production";

function cookieOptions() {
    const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProduction || sameSite === "none";
    return {
        httpOnly: true,
        secure,
        sameSite,
        path: "/api/auth",
        ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    };
}

// Format attendu : 64 caracteres hexadecimaux (randomToken(32)) ; toute autre valeur est ignoree.
function readDeviceCookie(req) {
    const value = req.cookies?.[DEVICE_COOKIE];
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function setDeviceCookie(res, token) {
    res.cookie(DEVICE_COOKIE, token, { ...cookieOptions(), maxAge: DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000 });
}

function clearDeviceCookie(res) {
    res.clearCookie(DEVICE_COOKIE, cookieOptions());
}

module.exports = { DEVICE_COOKIE, DEVICE_TTL_DAYS, readDeviceCookie, setDeviceCookie, clearDeviceCookie };
