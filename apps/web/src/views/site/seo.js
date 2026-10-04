// Metadonnees SEO communes (titre, description, hreflang, Open Graph, Twitter) et JSON-LD.
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, OG_LOCALES, localizePath } from "../../i18n/config";
import { resolveImage } from "../../utils/format";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001").replace(/\/$/, "");
export const SITE_NAME = "HOPE International";

export const absoluteUrl = (path) => `${SITE_URL}${path}`;

// hreflang : chaque langue + x-default (francais, sans prefixe).
export function languageAlternates(path) {
  const languages = Object.fromEntries(LOCALES.map((locale) => [locale, localizePath(locale, path)]));
  languages["x-default"] = localizePath(DEFAULT_LOCALE, path);
  return languages;
}

// Image de contenu (upload) en URL absolue pour Open Graph. Les SVG (illustrations par defaut)
// ne sont pas acceptes par les reseaux sociaux : l'image generee par defaut s'applique alors.
export function shareImage(url, alt) {
  const resolved = resolveImage(url);
  if (!resolved || resolved.split("?")[0].toLowerCase().endsWith(".svg")) return null;
  return { url: /^https?:\/\//.test(resolved) ? resolved : absoluteUrl(resolved), alt: alt || SITE_NAME };
}

// title : titre de la page (le gabarit " · HOPE International" est ajoute par le layout) ;
// absoluteTitle : titre complet sans gabarit (accueil). image : { url, alt } facultative,
// sinon l'image Open Graph generee par defaut.
// Image Open Graph generee (app/[locale]/opengraph-image.jsx), declaree explicitement : un objet
// openGraph defini par une page remplace sinon l'image heritee du segment [locale].
export const defaultShareImage = (locale) => ({
  url: `/${locale}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: SITE_NAME,
});

export function buildMetadata({ locale, path, title, absoluteTitle, description, image, type = "website", noindex = false, extra = {} }) {
  const url = localizePath(locale, path);
  const shared = image || defaultShareImage(locale);
  const fullTitle = absoluteTitle || `${title} · ${SITE_NAME}`;
  const openGraph = {
    type,
    siteName: SITE_NAME,
    locale: OG_LOCALES[locale],
    alternateLocale: LOCALES.filter((code) => code !== locale).map((code) => OG_LOCALES[code]),
    url,
    title: fullTitle,
    description,
    images: [shared],
    ...(extra.openGraph || {}),
  };
  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [shared.url],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

// Metadonnees d'une page statique a partir des cles site.meta.<page>.{title,description}.
export async function staticPageMetadata(params, page, path, options = {}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return buildMetadata({
    locale,
    path,
    title: t(`${page}.title`),
    description: t(`${page}.description`),
    ...options,
  });
}

// <script type="application/ld+json"> sans risque d'injection (</script>).
export function jsonLdProps(data) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") },
  };
}

export const truncateText = (text, length = 160) => {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value;
};
