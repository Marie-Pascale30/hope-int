const rateLimit = require("express-rate-limit");

const isProduction = process.env.NODE_ENV === "production";
const bypassLocal = process.env.BYPASS_LOCAL_RATE_LIMIT !== "false";
const LOCAL_IPS = ["::1", "127.0.0.1", "::ffff:127.0.0.1"];

// Limiteur standard ; en developpement, les requetes locales peuvent etre exemptees
// (BYPASS_LOCAL_RATE_LIMIT, actif par defaut hors production).
module.exports = function createLimiter({ windowMinutes, max, message }) {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: message },
        skip: (req) => !isProduction && bypassLocal && LOCAL_IPS.includes(req.ip),
    });
};
