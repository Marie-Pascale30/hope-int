// Candidatures : poles d'interet indicatifs (JSON) ; desired_roles est conserve pour l'historique.
// Messages : index sur le statut (filtre et compteur "non lus" du tableau de bord).
// Rejouable : chaque helper verifie l'etat du schema avant de le modifier.
const { addColumn, addIndex } = require("../config/schema");

exports.up = async () => {
    await addColumn("applications", "interests", "TEXT NULL AFTER desired_roles");
    await addIndex("messages", "idx_messages_status", "INDEX idx_messages_status (status)");
};
