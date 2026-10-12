// Chiffres d'impact publics (page d'accueil) : cache memoire court, la requete agregee etant
// sollicitee a chaque visite. IMPACT_CACHE_MS=0 desactive le cache.
const contentRepo = require("../repositories/contentRepository");
const statsRepo = require("../repositories/statsRepository");

const CACHE_MS = Number(process.env.IMPACT_CACHE_MS ?? 60 * 1000);

let cache = null;

exports.getImpact = async () => {
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    const [impact, donations] = await Promise.all([
        contentRepo.getImpactTotals(),
        statsRepo.getPublicDonationTotals(),
    ]);
    const value = { ...impact, ...donations };
    if (CACHE_MS > 0) cache = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
};

// Invalide le cache (ex. apres une modification importante, ou entre deux tests).
exports.clearCache = () => {
    cache = null;
};
