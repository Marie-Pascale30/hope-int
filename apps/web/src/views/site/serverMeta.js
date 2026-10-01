// Metadonnees des pages de detail, calculees cote serveur (titre du contenu).
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");

export async function detailMetadata(path, fallback, describe) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return fallback;
    const item = await res.json();
    return { title: item.title || fallback.title, description: describe(item) || fallback.description };
  } catch {
    return fallback;
  }
}
