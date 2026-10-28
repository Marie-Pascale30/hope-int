// Galeries photos des projets et des actualites : liste JSON de { src, width, height, kind? }
// affichee sous le contenu (photos du livret partenaires, voir @hope/shared/photos).
// Rejouable : addColumn verifie l'etat du schema.
const { addColumn } = require("../config/schema");

exports.up = async () => {
    await addColumn("projects", "gallery", "JSON NULL");
    await addColumn("news", "gallery", "JSON NULL");
};
