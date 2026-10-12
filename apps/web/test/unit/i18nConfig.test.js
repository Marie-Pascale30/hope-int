import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, LOCALES, localizePath } from "@/src/i18n/config";

describe("localizePath", () => {
  it("laisse les URL francaises sans prefixe", () => {
    expect(localizePath("fr", "/projets")).toBe("/projets");
    expect(localizePath("fr", "/")).toBe("/");
  });

  it("prefixe les autres langues", () => {
    expect(localizePath("en", "/projets")).toBe("/en/projets");
    expect(localizePath("es", "/")).toBe("/es");
    expect(localizePath("en", "don")).toBe("/en/don");
    expect(localizePath("en")).toBe("/en");
  });

  it("ignore une langue inconnue", () => {
    expect(localizePath("de", "/projets")).toBe("/projets");
  });

  it("expose des langues coherentes", () => {
    expect(LOCALES).toContain(DEFAULT_LOCALE);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("xx")).toBe(false);
  });
});
