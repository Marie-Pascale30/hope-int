// Lecture serveur des donnees publiques de transparence (composants serveur, SEO).
// Cache de 5 minutes, aligne sur celui de l'API.
import { cache } from "react";
import { SERVER_API_BASE_URL, ServerApiError } from "./server";

export const TRANSPARENCY_REVALIDATE = 300;

async function getJson(path, locale) {
  let response;
  try {
    response = await fetch(`${SERVER_API_BASE_URL}${path}`, {
      headers: { Accept: "application/json", ...(locale ? { "Accept-Language": locale } : {}) },
      next: { revalidate: TRANSPARENCY_REVALIDATE },
      signal: AbortSignal.timeout(8000),
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

const get = cache((path, locale) => getJson(path, locale));

export const transparencyServer = {
  index: (locale) => get("/transparency", locale),
  year: (year, locale) => get(`/transparency/${encodeURIComponent(String(year))}`, locale),
  regions: (locale) => get("/transparency/regions", locale),
  team: (locale) => get("/transparency/team", locale),
};
