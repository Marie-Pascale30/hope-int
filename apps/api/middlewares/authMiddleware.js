const jwt = require("jsonwebtoken");
const userRepo = require("../repositories/userRepository");
const { SESSION_COOKIE } = require("../config/session");

// Routes encore accessibles tant que le mot de passe provisoire n'a pas ete change.
const PASSWORD_CHANGE_ALLOWED = ["/api/auth/me", "/api/auth/change-password"];

// Le site s'authentifie par cookie httpOnly ; l'en-tete Bearer reste accepte pour les scripts et outils.
function readToken(req) {
    if (req.cookies?.[SESSION_COOKIE]) return req.cookies[SESSION_COOKIE];
    const authHeader = req.headers.authorization || "";
    return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

// Le jeton ne porte que l'identite : roles et statut sont relus en base a chaque requete,
// pour qu'un retrait de droits ou une desactivation prenne effet immediatement.
async function resolveUser(token) {
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_error) {
        return null;
    }

    const user = await userRepo.findAuthById(decoded.id);
    if (!user || user.status !== "active") return null;
    if (Number(decoded.tv || 0) !== Number(user.token_version || 0)) return null;
    return user;
}

function toRequestUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles,
        region: user.region,
        mustChangePassword: Boolean(user.must_change_password),
    };
}

async function requireAuth(req, res, next) {
    const token = readToken(req);
    if (!token) {
        return res.status(401).json({ error: "Authentification requise" });
    }

    const user = await resolveUser(token);
    if (!user) {
        return res.status(401).json({ error: "Session expirée, veuillez vous reconnecter" });
    }

    req.user = toRequestUser(user);

    const path = req.originalUrl.split("?")[0];
    if (req.user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.includes(path)) {
        return res.status(403).json({
            error: "Vous devez choisir un nouveau mot de passe avant de continuer",
            code: "PASSWORD_CHANGE_REQUIRED",
        });
    }

    next();
}

// Identifie l'utilisateur s'il est connecte, sans rien exiger (ex. don sans compte).
async function optionalAuth(req, _res, next) {
    const token = readToken(req);
    if (token) {
        const user = await resolveUser(token);
        if (user) req.user = toRequestUser(user);
    }
    next();
}

module.exports = requireAuth;
module.exports.optionalAuth = optionalAuth;
