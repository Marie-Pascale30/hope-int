// Service worker de Hope International (application installable, lecture hors connexion).
// - Fichiers Next versionnes (/_next/static) : cache d'abord, ils ne changent jamais.
// - Images et polices : copie en cache, rafraichie en arriere-plan.
// - Pages publiques : reseau d'abord, derniere version gardee pour la lecture hors connexion.
// - Pages personnelles (espace, admin, connexion, don...) et API : jamais mises en cache
//   (telephones souvent partages) ; hors connexion, elles affichent /offline.html.
// Changer VERSION a chaque modification de ce fichier pour purger les anciens caches.
const VERSION = "v1";
const STATIC_CACHE = `hope-static-${VERSION}`;
const ASSET_CACHE = `hope-assets-${VERSION}`;
const PAGE_CACHE = `hope-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icon.svg"];
const MAX_PAGES = 40;
const MAX_ASSETS = 120;

// Prefixe de langue facultatif (/en, /es) suivi d'une page personnelle ou de formulaire sensible.
const PRIVATE_PAGE = /^\/(?:(?:en|es|fr)\/)?(?:admin|espace|connexion|inscription|mot-de-passe-oublie|reinitialiser-mot-de-passe|changer-mot-de-passe|don)(?:\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, ASSET_CACHE, PAGE_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("hope-") && !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        await trim(ASSET_CACHE, MAX_ASSETS);
      }
      return response;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return refresh;
}

async function networkFirstPage(request, url, event) {
  const isPrivate = PRIVATE_PAGE.test(url.pathname);
  try {
    // Pages personnelles : ni cache du worker ni cache HTTP du navigateur.
    const response = await fetch(request, isPrivate ? { cache: "no-store" } : undefined);
    if (response.ok && !isPrivate) {
      const cache = await caches.open(PAGE_CACHE);
      event.waitUntil(cache.put(request, response.clone()).then(() => trim(PAGE_CACHE, MAX_PAGES)));
    }
    return response;
  } catch {
    const cached = isPrivate ? null : await caches.match(request, { ignoreSearch: true });
    return cached || caches.match(OFFLINE_URL);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // API (autre origine ou /api), navigation client Next (RSC) : toujours le reseau.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, url, event));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (["image", "font", "style"].includes(request.destination) || url.pathname.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
