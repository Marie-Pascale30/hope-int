// Genere les icones PNG de l'application installable (manifest, apple-touch-icon) a partir de
// l'embleme HOPE (pousse dans un cercle, voir app/icon.svg), sans dependance : rasterisation
// analytique sur-echantillonnee (4x4) et encodage PNG avec zlib (Node).
// Usage : node scripts/generate-icons.js   (ecrit dans public/icons/)
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "public", "icons");
const BRAND = [0x1f, 0x5f, 0x4a];
const CREAM = [0xfa, 0xf7, 0xf2];
const OCHRE = [0xd2, 0x77, 0x2a];

// ---------- Geometrie de l'embleme (repere 40 x 40 de app/icon.svg) ----------

function cubic(p0, p1, p2, p3, steps = 24) {
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const u = 1 - t;
        points.push([
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ]);
    }
    return points;
}

// Feuille ocre : M20 21 c0-5.5 3.8-9.2 9.5-9.5 -.3 5.7-4 9.5-9.5 9.5Z
const LEAF_RIGHT = [...cubic([20, 21], [20, 15.5], [23.8, 11.8], [29.5, 11.5]), ...cubic([29.5, 11.5], [29.2, 17.2], [25.5, 21], [20, 21])];
// Feuille claire : M20 24 c0-4.6-3.2-7.7-7.9-7.9 .2 4.7 3.3 7.9 7.9 7.9Z
const LEAF_LEFT = [...cubic([20, 24], [20, 19.4], [16.8, 16.3], [12.1, 16.1]), ...cubic([12.1, 16.1], [12.3, 20.8], [15.4, 24], [20, 24])];

function inPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

// Tige : segment (20,19)-(20,31), epaisseur 2.4, extremites arrondies.
function inStem(x, y) {
    const cy = Math.min(31, Math.max(19, y));
    return (x - 20) ** 2 + (y - cy) ** 2 <= 1.2 ** 2;
}

// Couleur de l'embleme en (x, y) du repere 40 x 40, ou null hors embleme.
function markColor(x, y, { circle }) {
    if (inPolygon(x, y, LEAF_RIGHT)) return OCHRE;
    if (inPolygon(x, y, LEAF_LEFT) || inStem(x, y)) return CREAM;
    if (!circle || (x - 20) ** 2 + (y - 20) ** 2 <= 400) return BRAND;
    return null;
}

// variant : "any" (cercle sur fond transparent) ou "full" (fond plein, embleme dans la zone
// sure des icones masquables : 80 % centraux).
function render(size, variant) {
    const SS = 4;
    const pixels = Buffer.alloc(size * size * 4);
    const scale = variant === "full" ? 1.25 : 1;
    for (let py = 0; py < size; py += 1) {
        for (let px = 0; px < size; px += 1) {
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;
            for (let sy = 0; sy < SS; sy += 1) {
                for (let sx = 0; sx < SS; sx += 1) {
                    const nx = (px + (sx + 0.5) / SS) / size;
                    const ny = (py + (sy + 0.5) / SS) / size;
                    const x = 20 + (nx - 0.5) * 40 / scale;
                    const y = 20 + (ny - 0.5) * 40 / scale;
                    const color = markColor(x, y, { circle: variant !== "full" }) || (variant === "full" ? BRAND : null);
                    if (color) {
                        r += color[0];
                        g += color[1];
                        b += color[2];
                        a += 1;
                    }
                }
            }
            const offset = (py * size + px) * 4;
            if (a) {
                pixels[offset] = Math.round(r / a);
                pixels[offset + 1] = Math.round(g / a);
                pixels[offset + 2] = Math.round(b / a);
            }
            pixels[offset + 3] = Math.round((a / (SS * SS)) * 255);
        }
    }
    return pixels;
}

// ---------- Encodage PNG (RGBA 8 bits) ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buffer) {
    let c = 0xffffffff;
    for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    const raw = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y += 1) {
        raw[y * (size * 4 + 1)] = 0;
        pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", header),
        chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

const ICONS = [
    { file: "icon-192.png", size: 192, variant: "any" },
    { file: "icon-512.png", size: 512, variant: "any" },
    { file: "icon-maskable-192.png", size: 192, variant: "full" },
    { file: "icon-maskable-512.png", size: 512, variant: "full" },
    { file: "apple-touch-icon.png", size: 180, variant: "full" },
];

if (require.main === module) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const icon of ICONS) {
        const png = encodePng(icon.size, render(icon.size, icon.variant));
        fs.writeFileSync(path.join(OUT, icon.file), png);
        console.log(`${icon.file} (${icon.size}px, ${png.length} octets)`);
    }
}

module.exports = { render, encodePng, ICONS };
