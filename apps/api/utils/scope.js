const { isRegionScoped } = require("@hope/shared/rbac");
const { forbidden } = require("./httpError");

const NO_REGION_MESSAGE = "Aucune région n'est associée à votre fiche : demandez aux RH de la renseigner";

// Region a laquelle les droits de l'acteur sont limites, ou null s'il n'est pas restreint
// (roles a portee globale, ou roles sans tableau de bord regional).
// Un acteur restreint sans region sur sa fiche n'a acces a rien de regional : refus explicite.
function getScopeRegion(actor) {
    if (!actor || !isRegionScoped(actor.roles)) return null;
    if (!actor.region) throw forbidden(NO_REGION_MESSAGE);
    return actor.region;
}

module.exports = { getScopeRegion, NO_REGION_MESSAGE };
