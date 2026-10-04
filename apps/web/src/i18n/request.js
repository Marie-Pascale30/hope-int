import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, TIME_ZONE, isLocale } from "./config";
import { loadMessages } from "./messages";

// Configuration next-intl de chaque requete serveur.
// - Site public : la langue vient du segment [locale] (setRequestLocale) ou du proxy.
// - Back-office (/admin, sans prefixe) : la langue vient du cookie de preference.
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  // Pas de langue dans la requete (back-office) : preference du cookie. Une valeur presente mais
  // invalide (segment inconnu) retombe sur le francais sans lire les cookies (rendu statique).
  if (locale === undefined) {
    try {
      locale = (await cookies()).get(LOCALE_COOKIE)?.value;
    } catch {
      locale = undefined;
    }
  }
  if (!isLocale(locale)) locale = DEFAULT_LOCALE;

  return {
    locale,
    timeZone: TIME_ZONE,
    messages: await loadMessages(locale),
    // Cle absente (traduction en cours) : on affiche la cle plutot que de casser la page.
    onError(error) {
      if (error.code === "MISSING_MESSAGE") {
        if (process.env.NODE_ENV !== "production") console.warn(`[i18n] ${error.message}`);
        return;
      }
      console.error(error);
    },
    getMessageFallback: ({ namespace, key }) => [namespace, key].filter(Boolean).join("."),
  };
});
