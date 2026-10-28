import { describe, expect, it } from "vitest";
import { PHOTOS, photoUrl } from "@hope/shared/photos";
import {
  DEFAULT_PHOTOS, PROJECT_THEMES, isLegacyIllustration, projectFallbackPhoto, projectTheme,
} from "@/src/views/site/projectCover";

const KINDS = Object.fromEntries(PHOTOS.map((photo) => [photo.id, photo.kind]));

describe("photo de repli des projets", () => {
  it("ne propose que des photos de terrain du livret", () => {
    const ids = [...PROJECT_THEMES.flatMap((theme) => theme.photos), ...DEFAULT_PHOTOS].map(([id]) => id);
    for (const id of ids) expect(KINDS[id], id).toBe("photo");
  });

  it("reconnait les anciennes illustrations SVG", () => {
    expect(isLegacyIllustration("/images/projects/microcredit.svg")).toBe(true);
    expect(isLegacyIllustration("/images/livret/p06_01.jpg")).toBe(false);
    expect(isLegacyIllustration(null)).toBe(false);
  });

  it("deduit le theme du titre, du resume ou de l'ancienne illustration", () => {
    expect(projectTheme({ title: "Microcrédit pour femmes rurales" })).toBe("femmes");
    expect(projectTheme({ title: "Éducation entrepreneuriale des jeunes", image_url: "/images/projects/formation.svg" })).toBe("education");
    expect(projectTheme({ title: "Groupes solidaires agricoles" })).toBe("agriculture");
    expect(projectTheme({ title: "Accès à l'eau potable à Garoua" })).toBe("eau");
    expect(projectTheme({ title: "Épargne et santé des familles" })).toBe("sante");
    expect(projectTheme({ title: "Noël de l'espoir pour les orphelins", summary: "vêtements et jouets" })).toBe("noel");
    expect(projectTheme({ title: "Un nouveau départ", summary: "Une beauté" })).toBeNull();
  });

  it("choisit une photo stable, differente pour des projets voisins du meme theme", () => {
    const a = projectFallbackPhoto({ id: 1, title: "Rentrée scolaire" });
    const b = projectFallbackPhoto({ id: 2, title: "Fournitures scolaires" });
    expect(a).toEqual(projectFallbackPhoto({ id: 1, title: "Rentrée scolaire" }));
    expect(a.src).not.toBe(b.src);
    expect(a.src).toMatch(/^\/images\/livret\/p\d+_\d+\.jpg$/);
  });

  it("prefere la premiere photo de terrain de la galerie du projet", () => {
    const gallery = JSON.stringify([{ src: photoUrl("p10_01") }, { src: photoUrl("p06_02") }]);
    expect(projectFallbackPhoto({ id: 3, title: "Projet", gallery })).toEqual({ src: photoUrl("p06_02") });
  });

  it("se replie sur les photos de l'association sans theme reconnu", () => {
    const { src } = projectFallbackPhoto({ id: 0, title: "Programme Adamaoua" });
    expect(src).toBe(photoUrl(DEFAULT_PHOTOS[0][0]));
  });
});
