import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "./src/i18n/routing";
import { buildSecurityHeaders, generateNonce } from "./security/headers";

// Proxy (ex-middleware) next-intl : choisit la langue (prefixe d'URL, puis cookie NEXT_LOCALE,
// puis Accept-Language), redirige vers /en/... ou /es/... si besoin et reecrit les URL
// francaises sans prefixe vers le segment [locale].
const handleI18nRouting = createMiddleware(routing);

// Back-office : pas de prefixe de langue (langue lue dans le cookie), donc pas de next-intl,
// mais memes en-tetes de securite que le site public.
const ADMIN_PATH = /^\/admin(?:\/|$)/;

const isDev = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";
// process.env.NEXT_PUBLIC_* est inline au build (l'URL publique de l'API) ;
// API_INTERNAL_URL est lue au demarrage du serveur (rendu serveur, reseau Docker).
const apiUrls = [process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api", process.env.API_INTERNAL_URL];

export default function proxy(request) {
  // Nonce unique par requete : Next le lit dans l'en-tete CSP de la requete et l'applique a ses
  // propres scripts ; x-nonce le rend lisible par les composants serveur (app/_lib/document.jsx).
  const nonce = generateNonce();
  const securityHeaders = buildSecurityHeaders({ nonce, isDev, isProduction, apiUrls });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", securityHeaders["Content-Security-Policy"]);

  // next-intl recopie request.headers dans ses rewrite/next : le nonce est transmis au rendu.
  const response = ADMIN_PATH.test(request.nextUrl.pathname)
    ? NextResponse.next({ request: { headers: request.headers } })
    : handleI18nRouting(request);

  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Exclus : fichiers statiques et internes Next, images Open Graph generees et fichiers
  // avec extension (robots.txt, sitemap.xml...). /admin passe par le proxy pour ses en-tetes.
  matcher: ["/((?!api(?:/|$)|_next|_vercel|.*opengraph-image|.*\\..*).*)"],
};
