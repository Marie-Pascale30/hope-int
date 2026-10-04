import { LOCALES } from "@/src/i18n/config";
import { SITE_URL } from "@/src/views/site/seo";

// Pages privees ou transactionnelles exclues de l'indexation (et leurs variantes /en, /es).
const PRIVATE_PATHS = [
  "/espace",
  "/connexion",
  "/inscription",
  "/changer-mot-de-passe",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/don/merci",
];

export default function robots() {
  const prefixes = ["", ...LOCALES.map((locale) => `/${locale}`)];
  const disallow = ["/admin", ...prefixes.flatMap((prefix) => PRIVATE_PATHS.map((path) => `${prefix}${path}`))];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...new Set(disallow)] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
