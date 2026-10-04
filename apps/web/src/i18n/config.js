// Langues du site : constantes sans dependance a next-intl (utilisables partout,
// y compris dans next.config.js, le proxy et le client axios).
export const LOCALES = ["fr", "en", "es"];
export const DEFAULT_LOCALE = "fr";

// Cookie de preference de langue (lu par le proxy et par le back-office sans prefixe d'URL).
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Noms affiches dans le selecteur, chacun dans sa propre langue.
export const LOCALE_NAMES = { fr: "Français", en: "English", es: "Español" };

// Etiquettes BCP 47 utilisees par Intl (dates, nombres, monnaies) et par Open Graph.
export const INTL_LOCALES = { fr: "fr-FR", en: "en-GB", es: "es-ES" };
export const OG_LOCALES = { fr: "fr_FR", en: "en_GB", es: "es_ES" };

// Les evenements ont lieu au Cameroun : dates et heures affichees dans ce fuseau,
// identique cote serveur et cote client (pas d'ecart a l'hydratation).
export const TIME_ZONE = "Africa/Douala";

export const isLocale = (value) => LOCALES.includes(value);

// Chemin public d'une page dans une langue : le francais n'a pas de prefixe.
// localizePath("en", "/projets") -> "/en/projets" ; localizePath("fr", "/") -> "/"
export function localizePath(locale, path = "/") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}
