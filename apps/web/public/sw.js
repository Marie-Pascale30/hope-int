/* Service worker HOPE International (ecrit a la main, sans bibliotheque).
 *
 * - Precache : pages hors ligne (fr / en / es) et quelques ressources statiques essentielles.
 * - Pages publiques : reseau d'abord, copie en cache, puis repli sur la copie puis sur la page
 *   hors ligne de la langue. Le HTML public ne contient aucune donnee de session (la session est
 *   un cookie de l'API, lu cote client) : il peut etre conserve.
 * - Jamais mis en cache : /api, l'administration, l'espace membre, le don et les paiements, la
 *   connexion et les mots de passe, les requetes authentifiees (en-tete Authorization), les autres
 *   origines (API, Stripe, prestataires) et les requetes autres que GET.
 * - Ressources statiques de Next (/_next/static, noms versionnes) : cache d'abord.
 * - Images et icones : cache puis mise a jour en arriere-plan (nombre d'entrees limite).
 */
const VERSION = "v1";
const STATIC_CACHE = `hope-static-${VERSION}`;
const PAGES_CACHE = `hope-pages-${VERSION}`;
const IMAGES_CACHE = `hope-images-${VERSION}`;
const MAX_PAGES = 40;
const MAX_IMAGES = 80;

const OFFLINE_PAGES = { fr: "/hors-ligne", en: "/en/hors-ligne", es: "/es/hors-ligne" };
const PRECACHE = [
  ...Object.values(OFFLINE_PAGES),
  "/manifest.json",
  "/icon.svg",
  "/icons/icon-192.png",
  "/images/placeholder.svg",
];

// Prefixes interdits au cache (apres retrait du prefixe de langue /en ou /es).
const PRIVATE_PREFIXES = [
  "/api", "/admin", "/espace", "/don", "/connexion", "/inscription", "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe", "/changer-mot-de-passe", "/payment", "/uploads",
];

function stripLocale(pathname) {
  const match = /^\/(en|es)(\/.*)?$/.exec(pathname);
  return match ? match[2] || "/" : pathname;
}

function localeOf(pathname) {
  const match = /^\/(en|es)(?:\/|$)/.exec(pathname);
  return match ? match[1] : "fr";
}

function isPrivatePath(pathname) {
  const path = stripLocale(pathname);
  return PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}

// Strategie d'une requete : "none" (navigateur seul), "static", "image" ou "page".
function classify(request, origin) {
  if (request.method !== "GET") return "none";
  const url = new URL(request.url);
  if (url.origin !== origin) return "none";
  if (request.headers.get("authorization")) return "none";
  if (isPrivatePath(url.pathname)) return "none";
  // Navigations internes de Next (flux RSC) : laissees au reseau ; hors ligne, Next bascule sur
  // une navigation complete, servie par la strategie "page".
  if (request.headers.get("rsc") || url.searchParams.has("_rsc")) return "none";
  if (url.pathname.startsWith("/_next/static/")) return "static";
  if (url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/images/") || url.pathname.startsWith("/icons/")) return "image";
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) return "page";
  return "none";
}

function offlinePathFor(pathname) {
  return OFFLINE_PAGES[localeOf(pathname)];
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}

// Une reponse n'est conservee que si elle est complete, de meme origine et sans redirection.
function storable(response) {
  return response && response.ok && response.type === "basic" && !response.redirected;
}

async function networkFirstPage(event) {
  const { request } = event;
  try {
    const response = await fetch(request);
    if (storable(response)) {
      const copy = response.clone();
      event.waitUntil(caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy)).then(() => trim(PAGES_CACHE, MAX_PAGES)));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    const offline = await caches.match(offlinePathFor(new URL(request.url).pathname));
    if (offline) return offline;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (storable(response)) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cached = await caches.match(request);
  const update = fetch(request)
    .then(async (response) => {
      if (storable(response)) {
        const cache = await caches.open(IMAGES_CACHE);
        await cache.put(request, response.clone());
        await trim(IMAGES_CACHE, MAX_IMAGES);
      }
      return response;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  return update;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Une ressource indisponible n'empeche pas l'installation.
      Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const keep = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("hope-") && !keep.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const strategy = classify(event.request, self.location.origin);
  if (strategy === "page") event.respondWith(networkFirstPage(event));
  else if (strategy === "static") event.respondWith(cacheFirst(event.request));
  else if (strategy === "image") event.respondWith(staleWhileRevalidate(event));
});

// Deconnexion ou demande explicite : purge des pages conservees.
self.addEventListener("message", (event) => {
  if (event.data === "hope:clear-pages") event.waitUntil(caches.delete(PAGES_CACHE));
});

// Expose pour les tests unitaires (test/unit/serviceWorker.test.js).
self.HOPE_SW = { classify, offlinePathFor, isPrivatePath, PRECACHE };
