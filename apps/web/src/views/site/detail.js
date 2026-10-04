import { notFound } from "next/navigation";
import { ServerApiError } from "../../services/server";

// Contenu introuvable ou non publie (404) ou identifiant invalide (400) : vraie page 404.
// Autre erreur (API indisponible) : { error } pour afficher un etat d'erreur dans la page.
export async function loadDetail(promise) {
  let result;
  try {
    result = { data: await promise, error: null };
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 404 || error.status === 400)) notFound();
    result = { data: null, error };
  }
  return result;
}

// Variante pour generateMetadata : null si le contenu n'est pas disponible.
export async function loadForMetadata(promise) {
  try {
    return await promise;
  } catch {
    return null;
  }
}
