import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES } from "./config";

// Prefixe "as-needed" : le francais garde les URL historiques (/projets),
// l'anglais et l'espagnol sont servis sous /en/... et /es/...
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeCookie: { name: LOCALE_COOKIE, maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" },
  // Les liens hreflang sont publies dans les metadonnees de chaque page.
  alternateLinks: false,
});
