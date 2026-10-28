import { describe, expect, it } from "vitest";
import { PHOTO_ALBUMS, PHOTOS } from "@hope/shared/photos";
import { getFormatters } from "@/src/utils/format";
import enSite from "@/src/i18n/messages/en/site.json";
import esSite from "@/src/i18n/messages/es/site.json";
import {
  ABOUT_PHOTOS, GALLERY_ALBUMS, GALLERY_YEARS, HOME_PHOTOS, contentGallery, galleryAlbums, parseGallery, selectPhotos,
} from "@/src/views/site/gallery";
import { BANNERS } from "@/src/components/site/PageBanner";
import { translator } from "../intl";

const t = translator("site.gallery");
const f = getFormatters("fr");
const ALL_IDS = PHOTOS.map((photo) => photo.id);

describe("page Galerie", () => {
  const albums = galleryAlbums(t, f);
  const ids = albums.flatMap((album) => album.items.map((item) => item.id));

  it("affiche les 145 photos du livret, chacune une seule fois", () => {
    expect(PHOTOS).toHaveLength(145);
    expect(ids).toHaveLength(145);
    expect(new Set(ids).size).toBe(145);
    expect([...ids].sort()).toEqual([...ALL_IDS].sort());
  });

  it("reprend les 24 albums, l'equipe en tete puis du plus recent au plus ancien", () => {
    expect(albums).toHaveLength(PHOTO_ALBUMS.length);
    expect(albums[0].key).toBe("equipe");
    const years = albums.slice(1).map((album) => album.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(GALLERY_YEARS).toEqual([2025, 2024, 2023, 2022, 2021]);
    expect(GALLERY_ALBUMS.map((album) => album.key)).toEqual(albums.map((album) => album.key));
  });

  it("donne un texte alternatif et une legende traduits a chaque photo", () => {
    for (const album of albums) {
      expect(album.title).not.toMatch(/^site\.gallery|albums\./);
      expect(album.caption).toBeTruthy();
      for (const item of album.items) {
        expect(item.alt).toBeTruthy();
        expect(item.alt).not.toMatch(/albums\.|posters\./);
        expect(item.caption).toContain(album.title);
        expect(item.width).toBeGreaterThan(0);
        expect(item.height).toBeGreaterThan(0);
        expect(item.src).toBe(`/images/livret/${item.id}.jpg`);
      }
    }
    const alts = albums.flatMap((album) => album.items.map((item) => item.alt));
    expect(new Set(alts).size).toBe(alts.length);
  });

  it("nomme les affiches, justificatifs et logo", () => {
    const byId = Object.fromEntries(albums.flatMap((album) => album.items).map((item) => [item.id, item]));
    expect(byId.p01_00.alt).toBe("Logo officiel de HOPE International Project");
    expect(byId.p05_01.alt).toMatch(/^Affiche : « Un vêtement = Un sourire »/);
    expect(byId.p19_02.alt).toMatch(/^Chèque cadeau \/ justificatif : Aux côtés de Noël Clinton, Douala/);
    expect(byId.p12_06.alt).toBe("Noël à l’orphelinat Mère Teresa la Vénérable, Douala — photo 2");
  });

  it("a des textes pour chaque album et chaque affiche en anglais et en espagnol", () => {
    for (const site of [enSite, esSite]) {
      for (const album of PHOTO_ALBUMS) {
        expect(site.site.gallery.albums[album.key]).toMatchObject({ title: expect.any(String), place: expect.any(String), caption: expect.any(String) });
      }
      for (const photo of PHOTOS.filter((item) => item.kind === "affiche")) {
        expect(site.site.gallery.posters[photo.id]).toEqual(expect.any(String));
      }
    }
  });
});

describe("photos des autres pages", () => {
  it("le parcours de la page Qui sommes-nous donne acces a toutes les photos", () => {
    const ids = Object.values(ABOUT_PHOTOS).flatMap(({ refs }) => selectPhotos(...refs).map((photo) => photo.id));
    expect([...ids].sort()).toEqual([...ALL_IDS].sort());
  });

  it("n'utilise que des photos du livret (accueil, couvertures, bandeaux)", () => {
    for (const id of [...HOME_PHOTOS, ...Object.values(ABOUT_PHOTOS).map(({ cover }) => cover).filter(Boolean)]) {
      expect(ALL_IDS).toContain(id);
    }
    for (const { src } of Object.values(BANNERS)) {
      expect(ALL_IDS).toContain(src.match(/\/images\/livret\/(\w+)\.jpg$/)?.[1]);
    }
  });
});

describe("champ gallery des projets et actualites", () => {
  const sample = [{ src: "/images/livret/p12_06.jpg", width: 645, height: 618, kind: "photo" }, { src: "/uploads/x.jpg" }];

  it("accepte un tableau, une chaine JSON ou rien", () => {
    expect(parseGallery(null)).toEqual([]);
    expect(parseGallery(undefined)).toEqual([]);
    expect(parseGallery("pas du json")).toEqual([]);
    expect(parseGallery("{}")).toEqual([]);
    expect(parseGallery(JSON.stringify(sample))).toHaveLength(2);
    expect(parseGallery([...sample, null, { src: "" }, { width: 3 }])).toHaveLength(2);
  });

  it("reprend les textes du catalogue et complete les images inconnues", () => {
    const [known, upload] = contentGallery(t, f, sample, "Noël 2023");
    expect(known.alt).toBe("Noël à l’orphelinat Mère Teresa la Vénérable, Douala — photo 2");
    expect(upload).toMatchObject({ src: "/uploads/x.jpg", width: 800, height: 600, alt: "Noël 2023 — photo 2" });
  });
});
