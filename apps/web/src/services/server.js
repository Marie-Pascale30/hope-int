// Appels a l'API depuis les composants serveur (rendu des pages publiques).
// En Docker, le conteneur du site joint l'API par le reseau interne (API_INTERNAL_URL,
// ex. http://backend:5000/api) ; sinon on reprend l'URL publique.
import { cache } from "react";

export const SERVER_API_BASE_URL = (
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

// Duree de mise en cache des reponses publiques (secondes).
export const PUBLIC_REVALIDATE = 60;
const TIMEOUT_MS = 8000;

export class ServerApiError extends Error {
  constructor(status, message) {
    super(message || `API ${status}`);
    this.status = status;
  }
}

export const isNotFoundError = (error) => error instanceof ServerApiError && error.status === 404;

// GET JSON avec cache (revalidation periodique). Leve ServerApiError si la reponse n'est pas 2xx
// (status 0 : API injoignable ou trop lente).
async function getJson(path, locale) {
  let response;
  try {
    response = await fetch(`${SERVER_API_BASE_URL}${path}`, {
      headers: { Accept: "application/json", ...(locale ? { "Accept-Language": locale } : {}) },
      next: { revalidate: PUBLIC_REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new ServerApiError(0, error?.message || "API injoignable");
  }
  if (!response.ok) {
    let message;
    try {
      message = (await response.json())?.error;
    } catch {
      message = undefined;
    }
    throw new ServerApiError(response.status, message);
  }
  return response.json();
}

// Dedoublonne les appels identiques d'un meme rendu (generateMetadata + page).
const get = cache((path, locale) => getJson(path, locale));

// Resultat sans exception : { data, error } (pour un contenu partiel plutot qu'une page d'erreur).
export async function settle(promise) {
  try {
    return { data: await promise, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

const idPath = (id) => encodeURIComponent(String(id));

export const serverApi = {
  meta: (locale) => get("/meta", locale),
  impact: (locale) => get("/impact", locale),
  listContent: (type, locale) => get(`/content/${type}`, locale),
  getContent: (type, id, locale) => get(`/content/${type}/${idPath(id)}`, locale),
  listEvents: (locale) => get("/events", locale),
  getEvent: (id, locale) => get(`/events/${idPath(id)}`, locale),
};
