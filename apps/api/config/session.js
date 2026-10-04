// Session : le JWT voyage dans un cookie httpOnly, illisible par le JavaScript du site.
const SESSION_COOKIE = "hope_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

const isProduction = process.env.NODE_ENV === "production";

function cookieOptions() {
    // SameSite=None (API et site sur des domaines differents) impose Secure.
    const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProduction || sameSite === "none";
    return {
        httpOnly: true,
        secure,
        sameSite,
        path: "/api",
        ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    };
}

function setSessionCookie(res, token) {
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
}

function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// Protection CSRF : toute requete d'ecriture authentifiee par cookie doit porter un en-tete
// personnalise. Un site tiers ne peut pas l'ajouter sans preflight CORS, refuse hors des origines autorisees.
const CSRF_HEADER = "x-requested-with";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function csrfGuard(req, res, next) {
    if (UNSAFE_METHODS.has(req.method) && req.cookies?.[SESSION_COOKIE] && req.get(CSRF_HEADER) !== "XMLHttpRequest") {
        return res.status(403).json({ error: "Requête refusée (protection CSRF)", code: "CSRF_REJECTED" });
    }
    next();
}

module.exports = {
    SESSION_COOKIE,
    SESSION_TTL_SECONDS,
    setSessionCookie,
    clearSessionCookie,
    csrfGuard,
};
