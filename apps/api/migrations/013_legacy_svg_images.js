// Anciennes illustrations SVG (premier seed : /images/news/*.svg, /images/events/*.svg,
// /images/projects/*.svg) remplacees par de vraies photos du livret partenaires ; les fichiers
// ont ete retires du site. Les projets repassent sans image : le site choisit alors une photo
// selon leur theme. Rejouable : seules les adresses d'origine sont visees.
const { photoUrl } = require("@hope/shared/photos");

exports.up = async ({ db }) => {
    // Membres de HOPE avec les enfants (Noel 2023 a Bonaberi) / l'equipe mains reunies.
    await db.query("UPDATE news SET image_url = ?, image_alt = NULL WHERE image_url LIKE '/images/news/%.svg'", [photoUrl("p13_09")]);
    await db.query("UPDATE events SET image_url = ?, image_alt = NULL WHERE image_url LIKE '/images/events/%.svg'", [photoUrl("p05_03")]);
    await db.query("UPDATE projects SET image_url = NULL WHERE image_url LIKE '/images/projects/%.svg'");
    await db.query("UPDATE news SET image_url = NULL WHERE image_url LIKE '/images/projects/%.svg'");
};
