const { hasPermission } = require("@hope/shared/rbac");

module.exports = (...requiredPermissions) => {
    return (req, res, next) => {
        const roles = Array.isArray(req.user?.roles)
            ? req.user.roles
            : req.user?.role
                ? [req.user.role]
                : [];

        if (!roles.length) {
            return res.status(403).json({ error: "Acces interdit" });
        }

        const missing = requiredPermissions.filter((p) => !hasPermission(roles, p));
        if (missing.length > 0) {
            return res.status(403).json({
                error: "Permission insuffisante",
                missingPermissions: missing,
            });
        }

        next();
    };
};
