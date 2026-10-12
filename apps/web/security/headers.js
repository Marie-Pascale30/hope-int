// En-tetes de securite du site (CSP avec nonce par requete, HSTS, etc.).
// Module pur, sans dependance a Next : utilise par proxy.js et teste unitairement
// (test/security-headers.test.js).

// Prestataire de paiement par carte (Stripe Elements) : script, iframes et API.
// https://docs.stripe.com/security/guide#content-security-policy
const STRIPE_SCRIPT = ["https://js.stripe.com", "https://*.js.stripe.com"];
const STRIPE_FRAMES = ["https://js.stripe.com", "https://*.js.stripe.com", "https://hooks.stripe.com"];
const STRIPE_API = ["https://api.stripe.com"];

/** Origine (schema://hote[:port]) d'une URL absolue, ou null si l'URL est absente/invalide. */
export function originOf(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Nonce aleatoire (base64 de 128 bits), a generer a chaque requete. */
export function generateNonce() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Construit la valeur de l'en-tete Content-Security-Policy.
 * @param {object} options
 * @param {string} options.nonce      nonce de la requete (obligatoire)
 * @param {boolean} [options.isDev]   developpement : 'unsafe-eval' (React/Turbopack) et websockets HMR
 * @param {string[]} [options.apiUrls] URL de l'API (publique et interne) dont on autorise l'origine
 */
export function buildContentSecurityPolicy({ nonce, isDev = false, apiUrls = [] }) {
  if (!nonce || !/^[A-Za-z0-9+/=_-]+$/.test(nonce)) {
    throw new Error("Nonce CSP manquant ou invalide");
  }
  const apiOrigins = unique(apiUrls.map(originOf));

  const directives = {
    "default-src": ["'self'"],
    // 'strict-dynamic' : les scripts charges par un script porteur du nonce (runtime Next,
    // loadStripe) sont autorises ; les listes d'hotes ne servent qu'aux navigateurs CSP2.
    "script-src": unique([
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...STRIPE_SCRIPT,
      isDev && "'unsafe-eval'",
    ]),
    // 'unsafe-inline' : attributs style="" de React, styles injectes par sweetalert2 et
    // Chart.js. Les styles ne peuvent pas executer de code ; a durcir si ces usages disparaissent.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": unique(["'self'", "data:", "blob:", ...apiOrigins]),
    "font-src": ["'self'"],
    "connect-src": unique(["'self'", ...apiOrigins, ...STRIPE_API, isDev && "ws:", isDev && "wss:"]),
    "frame-src": STRIPE_FRAMES,
    // Application installable : service worker (/sw.js) et manifeste servis par le site lui-meme.
    // Explicites : sans worker-src, le navigateur retomberait sur script-src ('strict-dynamic').
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Tous les en-tetes de securite d'une reponse HTML.
 * @param {object} options
 * @param {string} options.nonce
 * @param {boolean} [options.isDev]
 * @param {boolean} [options.isProduction] HSTS uniquement en production
 * @param {string[]} [options.apiUrls]
 * @returns {Record<string, string>}
 */
export function buildSecurityHeaders({ nonce, isDev = false, isProduction = false, apiUrls = [] }) {
  const headers = {
    "Content-Security-Policy": buildContentSecurityPolicy({ nonce, isDev, apiUrls }),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Stripe peut utiliser Payment Request (Apple Pay / Google Pay) dans ses iframes.
    "Permissions-Policy": 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self "https://js.stripe.com")',
  };
  if (isProduction) {
    // Ignore par les navigateurs sur une connexion HTTP (docker compose local).
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  }
  return headers;
}
