// Genere les sources d'icones et d'ecrans de demarrage (assets/*.png) a partir du logo officiel
// HOPE International Project, avec sharp. Les versions detourees du logo sont produites par
// apps/web/scripts/generate-icons.js (a lancer avant). Ensuite : npm run assets -w @hope/mobile
// (capacitor-assets) pour decliner ces sources dans les dossiers natifs android/ et ios/.
// Usage : node scripts/generate-assets.js
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(__dirname, "..", "assets");
const BRAND_DIR = path.join(__dirname, "..", "..", "web", "public", "images", "brand");
const SUN = path.join(BRAND_DIR, "soleil-hope-detoure.png");
const LOGO = path.join(BRAND_DIR, "logo-hope-detoure.png");
// Fonds de la charte : creme (theme clair) et brun tres sombre (theme sombre, --bg).
const CREAM = "#fbf7f0";
const DARK = "#17110e";
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Image `source` redimensionnee dans une boite width x height, centree sur un canevas de `size`.
// Avec opaque, le resultat est aplati (sans canal alpha : exige pour l'icone iOS).
async function centered(source, size, width, height, background, { opaque = false } = {}) {
    const input = await sharp(source).resize(width, height, { fit: "contain", background: TRANSPARENT }).png().toBuffer();
    const meta = await sharp(input).metadata();
    const canvas = await sharp({ create: { width: size, height: size, channels: 4, background } })
        .composite([{ input, top: Math.round((size - meta.height) / 2), left: Math.round((size - meta.width) / 2) }])
        .png()
        .toBuffer();
    // sharp applique composite en dernier : l'aplatissement se fait sur une seconde passe.
    return opaque ? sharp(canvas).flatten({ background }) : sharp(canvas);
}

async function main() {
    // Icone complete (iOS, anciens Android) : soleil sur fond creme, sans transparence.
    await (await centered(SUN, 1024, 800, 800, CREAM, { opaque: true })).png().toFile(path.join(OUT, "icon-only.png"));
    // Icone adaptative Android : premier plan dans la zone sure (66 % centraux), fond uni.
    await (await centered(SUN, 1024, 600, 600, TRANSPARENT)).png().toFile(path.join(OUT, "icon-foreground.png"));
    await sharp({ create: { width: 1024, height: 1024, channels: 3, background: CREAM } }).png().toFile(path.join(OUT, "icon-background.png"));
    // Ecrans de demarrage : logo complet sur creme (1000 px de large : reste visible apres le
    // recadrage CENTER_CROP d'un ecran de telephone en portrait) ; en sombre, soleil seul (le brun du mot
    // "HOPE" serait illisible sur fond sombre).
    await (await centered(LOGO, 2732, 1000, 389, CREAM, { opaque: true })).png().toFile(path.join(OUT, "splash.png"));
    await (await centered(SUN, 2732, 640, 640, DARK, { opaque: true })).png().toFile(path.join(OUT, "splash-dark.png"));
    console.log("assets : icon-only, icon-foreground, icon-background, splash, splash-dark");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
