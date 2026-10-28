// Genere les icones de l'application installable (manifest, apple-touch-icon) et le favicon.ico
// a partir de l'embleme officiel HOPE (soleil, public/images/brand/soleil-hope.png), avec sharp.
// Les fichiers fournis ont un fond blanc opaque : on en tire d'abord des versions detourees
// (soleil-hope-detoure.png, logo-hope-detoure.png) utilisables sur fond creme ou sombre.
// Usage : node scripts/generate-icons.js
//   (ecrit dans public/icons/, public/images/brand/ et app/favicon.ico)
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "icons");
const BRAND_DIR = path.join(ROOT, "public", "images", "brand");
const SUN_SOURCE = path.join(BRAND_DIR, "soleil-hope.png");
const LOGO_SOURCE = path.join(BRAND_DIR, "logo-hope.png");
const SUN = path.join(BRAND_DIR, "soleil-hope-detoure.png");
const LOGO = path.join(BRAND_DIR, "logo-hope-detoure.png");
const FAVICON = path.join(ROOT, "app", "favicon.ico");
// Fond creme de la charte (--bg du theme clair).
const CREAM = { r: 0xfb, g: 0xf7, b: 0xf0, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// variant : "any" (carre creme a coins arrondis, soleil a 84 %), "full" (fond creme plein,
// soleil dans la zone sure des icones masquables : 80 % centraux, ici 72 %).
const ICONS = [
    { file: "icon-192.png", size: 192, variant: "any" },
    { file: "icon-512.png", size: 512, variant: "any" },
    { file: "icon-maskable-192.png", size: 192, variant: "full" },
    { file: "icon-maskable-512.png", size: 512, variant: "full" },
    { file: "apple-touch-icon.png", size: 180, variant: "full" },
];

// Detourage : le fond blanc relie aux bords (remplissage par diffusion) devient transparent ;
// la frange anticrenelee (2 px autour du fond) est "demelangee" du blanc. L'interieur
// (reflets) reste intact. keep : disque {cx, cy, r} protege (globe du logo, ses nuages sont
// blancs) ; hors de ce disque, tout blanc est retire (contreformes des lettres O, P, R, A...).
async function removeWhiteBackground(source, target, { keep } = {}) {
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const at = (x, y) => (y * width + x) * 4;
    const isWhite = (i) => Math.min(data[i], data[i + 1], data[i + 2]) >= 235;
    const background = new Uint8Array(width * height);
    const stack = [];
    for (let x = 0; x < width; x += 1) stack.push(x, 0, x, height - 1);
    for (let y = 0; y < height; y += 1) stack.push(0, y, width - 1, y);
    while (stack.length) {
        const y = stack.pop();
        const x = stack.pop();
        if (x < 0 || y < 0 || x >= width || y >= height || background[y * width + x] || !isWhite(at(x, y))) continue;
        background[y * width + x] = 1;
        stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    if (keep) {
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                if ((x - keep.cx) ** 2 + (y - keep.cy) ** 2 > keep.r ** 2 && isWhite(at(x, y))) background[y * width + x] = 1;
            }
        }
    }
    const nearBackground = (x, y) => {
        for (let dy = -2; dy <= 2; dy += 1) {
            for (let dx = -2; dx <= 2; dx += 1) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < width && ny < height && background[ny * width + nx]) return true;
            }
        }
        return false;
    };
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const i = at(x, y);
            if (background[y * width + x]) {
                data[i + 3] = 0;
            } else if (nearBackground(x, y)) {
                const alpha = (255 - Math.min(data[i], data[i + 1], data[i + 2])) / 255;
                if (alpha <= 0) {
                    data[i + 3] = 0;
                    continue;
                }
                for (let c = 0; c < 3; c += 1) {
                    data[i + c] = Math.round(Math.min(255, Math.max(0, (data[i + c] - 255 * (1 - alpha)) / alpha)));
                }
                data[i + 3] = Math.round(alpha * 255);
            }
        }
    }
    await sharp(data, { raw: { width, height, channels: 4 } }).trim().png({ compressionLevel: 9 }).toFile(target);
}

// Soleil detoure redimensionne, centre dans un carre de `size` pixels.
async function sunLayer(size, ratio) {
    const inner = Math.round(size * ratio);
    const sun = await sharp(SUN).resize(inner, inner, { fit: "contain", background: TRANSPARENT }).png().toBuffer();
    const offset = Math.round((size - inner) / 2);
    return { input: sun, top: offset, left: offset };
}

async function renderIcon(size, variant) {
    const ratio = variant === "full" ? 0.72 : 0.84;
    const base =
        variant === "full"
            ? sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
            : sharp(
                  Buffer.from(
                      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#fbf7f0"/></svg>`
                  )
              );
    return base.composite([await sunLayer(size, ratio)]).png({ compressionLevel: 9 }).toBuffer();
}

// Favicon multi-resolution : fichier ICO contenant des images PNG (16, 32 et 48 px), soleil seul.
async function renderFavicon() {
    const sizes = [16, 32, 48];
    const images = await Promise.all(
        sizes.map((size) => sharp(SUN).resize(size, size, { fit: "contain", background: TRANSPARENT }).png().toBuffer())
    );
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(sizes.length, 4);
    let offset = 6 + 16 * sizes.length;
    const entries = sizes.map((size, index) => {
        const entry = Buffer.alloc(16);
        entry[0] = size;
        entry[1] = size;
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(images[index].length, 8);
        entry.writeUInt32LE(offset, 12);
        offset += images[index].length;
        return entry;
    });
    return Buffer.concat([header, ...entries, ...images]);
}

async function main() {
    await removeWhiteBackground(SUN_SOURCE, SUN);
    // Globe du logo officiel (1178 x 458) : centre (777, 180), rayon 100 px.
    await removeWhiteBackground(LOGO_SOURCE, LOGO, { keep: { cx: 777, cy: 180, r: 103 } });
    console.log("soleil-hope-detoure.png, logo-hope-detoure.png");
    fs.mkdirSync(OUT, { recursive: true });
    for (const icon of ICONS) {
        const png = await renderIcon(icon.size, icon.variant);
        fs.writeFileSync(path.join(OUT, icon.file), png);
        console.log(`${icon.file} (${icon.size}px, ${png.length} octets)`);
    }
    const ico = await renderFavicon();
    fs.writeFileSync(FAVICON, ico);
    console.log(`favicon.ico (16/32/48px, ${ico.length} octets)`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { removeWhiteBackground, renderIcon, renderFavicon, ICONS };
