import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fromDateTimeLocalValue, getFormatters, initials, resolveImage, toDateTimeLocalValue, toIntlLocale, truncate,
} from "@/src/utils/format";

// Espaces insecables (fines ou non) produits par Intl, normalises pour comparer.
const plain = (value) => value.replace(/[  ]/g, " ");

describe("getFormatters", () => {
  const fr = getFormatters("fr");
  const en = getFormatters("en");

  afterEach(() => vi.useRealTimers());

  it("associe la langue du site a une etiquette Intl", () => {
    expect(fr.locale).toBe("fr-FR");
    expect(en.locale).toBe("en-GB");
    expect(toIntlLocale("de")).toBe("de");
    expect(fr.timeZone).toBe("Africa/Douala");
  });

  it("formate les montants en euros et en FCFA", () => {
    expect(plain(fr.money(25, "eur"))).toBe("25 €");
    expect(plain(fr.money(12.5, "eur"))).toBe("12,50 €");
    expect(plain(fr.money(10000, "xaf"))).toBe("10 000 FCFA");
    expect(en.money(25, "EUR")).toBe("€25");
    expect(plain(fr.money("abc"))).toBe("0 €");
  });

  it("formate une colonne DATE sans changer de jour", () => {
    expect(fr.date("2026-03-01")).toBe("1 mars 2026");
    expect(en.date("2026-03-01")).toBe("1 March 2026");
    expect(fr.shortDate("2026-12-31")).toBe("31/12/2026");
  });

  it("affiche les heures dans le fuseau de Douala (UTC+1)", () => {
    expect(fr.time("2026-05-10T08:30:00Z")).toBe("09:30");
    expect(fr.dayKey("2026-05-10T23:30:00Z")).toBe("2026-05-11");
    expect(fr.monthKey("2026-05-10T08:30:00Z")).toBe("2026-05");
  });

  it("renvoie un tiret (ou vide) pour une date absente ou invalide", () => {
    expect(fr.date(null)).toBe("—");
    expect(fr.date("pas une date")).toBe("—");
    expect(fr.time(undefined)).toBe("");
    expect(fr.dayKey("")).toBe("");
  });

  it("formate une cle AAAA-MM", () => {
    expect(fr.key("2026-03", { month: "long", year: "numeric" })).toBe("mars 2026");
    expect(fr.key("")).toBe("");
  });

  it("formate une date relative", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    expect(fr.relative("2026-06-14T12:00:00Z")).toBe("hier");
    expect(en.relative("2026-06-18T12:00:00Z")).toBe("in 3 days");
    expect(fr.relative(null)).toBe("—");
  });
});

describe("toDateTimeLocalValue / fromDateTimeLocalValue", () => {
  it("convertit une date ISO en valeur datetime-local (heure locale)", () => {
    expect(toDateTimeLocalValue("2026-05-10T08:30:00Z")).toBe("2026-05-10T09:30");
    expect(toDateTimeLocalValue("2026-03-01")).toBe("2026-03-01T00:00");
  });

  it("renvoie une chaine vide pour une valeur absente ou invalide", () => {
    expect(toDateTimeLocalValue("")).toBe("");
    expect(toDateTimeLocalValue("n'importe quoi")).toBe("");
    expect(fromDateTimeLocalValue("")).toBe("");
    expect(fromDateTimeLocalValue("invalide")).toBe("");
  });

  it("fait l'aller-retour vers l'ISO UTC", () => {
    expect(fromDateTimeLocalValue("2026-05-10T09:30")).toBe("2026-05-10T08:30:00.000Z");
  });
});

describe("truncate / initials / resolveImage", () => {
  it("tronque au-dela de la longueur demandee, sans espace final", () => {
    expect(truncate("court", 10)).toBe("court");
    expect(truncate("un texte assez long", 9)).toBe("un texte…");
    expect(truncate(null)).toBe("");
  });

  it("extrait au plus deux initiales", () => {
    expect(initials("Alice Marie Supporter")).toBe("AM");
    expect(initials("  Brice  ")).toBe("B");
    expect(initials()).toBe("");
  });

  it("sert les uploads depuis l'API et laisse les autres URL intactes", () => {
    expect(resolveImage("/uploads/a.png")).toBe("http://localhost:5000/uploads/a.png");
    expect(resolveImage("/images/projects/eau.svg")).toBe("/images/projects/eau.svg");
    expect(resolveImage("https://cdn.example.org/x.jpg")).toBe("https://cdn.example.org/x.jpg");
    expect(resolveImage("")).toBeNull();
  });
});
