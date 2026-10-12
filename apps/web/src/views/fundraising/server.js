// Lecture des collectes depuis les composants serveur (page publique /collecte/[slug]).
import { cache } from "react";
import { notFound } from "next/navigation";
import { PUBLIC_REVALIDATE, SERVER_API_BASE_URL } from "../../services/server";

const TIMEOUT_MS = 8000;

// Collecte publiee (ou cloturee) ; null si introuvable, leve une erreur si l'API est indisponible.
async function fetchFundraiser(slug, locale) {
  if (!/^[a-z0-9-]{3,80}$/.test(String(slug))) return null;
  const response = await fetch(`${SERVER_API_BASE_URL}/fundraising/fundraisers/public/${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json", ...(locale ? { "Accept-Language": locale } : {}) },
    // Jauge et soutiens : rafraichis plus souvent que les contenus editoriaux.
    next: { revalidate: Math.min(PUBLIC_REVALIDATE, 30) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404 || response.status === 422) return null;
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

export const getFundraiser = cache(fetchFundraiser);

// Page : 404 si la collecte n'existe pas ; { error } si l'API ne repond pas.
export async function loadFundraiser(slug, locale) {
  let data;
  try {
    data = await getFundraiser(slug, locale);
  } catch (error) {
    return { data: null, error };
  }
  if (!data) notFound();
  return { data, error: null };
}
