import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

// Proxy (ex-middleware) next-intl : choisit la langue (prefixe d'URL, puis cookie NEXT_LOCALE,
// puis Accept-Language), redirige vers /en/... ou /es/... si besoin et reecrit les URL
// francaises sans prefixe vers le segment [locale].
export default createMiddleware(routing);

export const config = {
  // Exclus : back-office (langue lue dans le cookie), fichiers statiques et internes Next,
  // images Open Graph generees et fichiers avec extension (robots.txt, sitemap.xml...).
  matcher: ["/((?!api(?:/|$)|admin(?:/|$)|_next|_vercel|.*opengraph-image|.*\\..*).*)"],
};
