// Carte simplifiee des 10 regions du Cameroun, dessinee a la main a partir de reperes
// approximatifs (longitude, latitude) : traces volontairement grossiers mais reconnaissables,
// sans fichier cartographique tiers. Les frontieres communes reutilisent les memes points
// (jonctions J1 a J7), ce qui evite trous et chevauchements entre regions voisines.
//
// Projection equirectangulaire simple : x = (lon - 8.4) * 40, y = (13.3 - lat) * 40.

export const MAP_WIDTH = 320;
export const MAP_HEIGHT = 472;

const J1 = [11.2, 6.1]; // Adamaoua / Centre / Ouest / Nord-Ouest
const J2 = [12.9, 3.5]; // Centre / Est / Sud
const J3 = [10.5, 3.45]; // Centre / Sud / Littoral
const J4 = [10.8, 4.9]; // Centre / Littoral / Ouest
const J5 = [9.95, 3.45]; // cote : Littoral / Sud
const J6 = [9.85, 4.95]; // Littoral / Ouest / Sud-Ouest
const J7 = [9.8, 5.9]; // Nord-Ouest / Ouest / Sud-Ouest

// Nom de region identique au referentiel REGIONS de @hope/shared.
export const REGION_SHAPES = [
  {
    region: "Extrême-Nord",
    points: [[14.1, 13.05], [14.6, 12.2], [15.0, 11.7], [15.1, 10.9], [15.6, 10.1], [14.2, 9.95], [13.3, 10.1], [13.7, 10.9], [13.8, 11.5], [14.15, 12.3]],
  },
  {
    region: "Nord",
    points: [[13.3, 10.1], [14.2, 9.95], [15.6, 10.1], [15.75, 9.2], [15.5, 8.1], [14.4, 7.95], [13.2, 7.9], [12.2, 8.0], [12.4, 8.6], [12.8, 9.4]],
  },
  {
    region: "Adamaoua",
    points: [[12.2, 8.0], [13.2, 7.9], [14.4, 7.95], [15.5, 8.1], [15.1, 7.2], [14.6, 6.2], [13.6, 6.0], [12.6, 6.1], J1, [11.4, 7.0], [11.9, 7.5]],
  },
  {
    region: "Nord-Ouest",
    points: [J7, [9.7, 6.3], [10.0, 6.6], [10.6, 7.1], [11.4, 7.0], J1, [10.6, 5.7], [10.2, 5.7]],
  },
  {
    region: "Ouest",
    points: [J7, [10.2, 5.7], [10.6, 5.7], J1, [11.2, 5.5], J4, [10.3, 5.1], J6, [10.0, 5.4]],
  },
  {
    region: "Sud-Ouest",
    points: [[9.55, 4.05], [9.2, 3.95], [8.9, 4.25], [8.6, 4.6], [8.8, 5.3], [9.3, 5.9], J7, [10.0, 5.4], J6, [9.7, 4.4]],
  },
  {
    region: "Littoral",
    points: [J5, J3, [10.6, 4.0], J4, [10.3, 5.1], J6, [9.7, 4.4], [9.55, 4.05], [9.65, 3.8]],
  },
  {
    region: "Centre",
    points: [J1, [12.6, 6.1], [13.6, 6.0], [12.9, 5.3], [12.6, 4.6], [12.9, 4.0], J2, [12.0, 3.3], [11.0, 3.4], J3, [10.6, 4.0], J4, [11.2, 5.5]],
  },
  {
    region: "Sud",
    points: [J3, [11.0, 3.4], [12.0, 3.3], J2, [13.2, 3.0], [13.3, 2.2], [12.3, 2.15], [11.3, 2.2], [9.8, 2.3], [9.85, 2.95], J5],
  },
  {
    region: "Est",
    points: [
      [13.6, 6.0], [14.6, 6.2], [14.4, 5.0], [14.6, 4.2], [15.1, 3.6], [16.1, 2.9], [16.2, 2.2], [16.0, 1.7], [15.2, 1.9],
      [14.0, 2.2], [13.3, 2.2], [13.2, 3.0], J2, [12.9, 4.0], [12.6, 4.6], [12.9, 5.3],
    ],
  },
];

export const project = ([lon, lat]) => [Math.round((lon - 8.4) * 400) / 10, Math.round((13.3 - lat) * 400) / 10];

// Chemin SVG ferme d'une liste de points (longitude, latitude).
export function toPath(points) {
  return `${points.map((point, index) => `${index ? "L" : "M"}${project(point).join(" ")}`).join(" ")} Z`;
}

// Centre de gravite du polygone (formule de l'aire signee), en coordonnees SVG.
export function centroid(points) {
  const projected = points.map(project);
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const [x0, y0] = projected[i];
    const [x1, y1] = projected[(i + 1) % projected.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  return [Math.round((cx / (6 * area)) * 10) / 10, Math.round((cy / (6 * area)) * 10) / 10];
}

// Niveau d'intensite (0 a 3) d'une region selon son nombre de projets rapporte au maximum.
export function intensity(count, max) {
  if (!count || !max) return 0;
  return Math.min(3, Math.max(1, Math.ceil((count / max) * 3)));
}

export const REGION_PATHS = REGION_SHAPES.map(({ region, points }) => ({
  region,
  d: toPath(points),
  center: centroid(points),
}));
