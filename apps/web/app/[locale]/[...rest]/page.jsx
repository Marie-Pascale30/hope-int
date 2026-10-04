import { notFound } from "next/navigation";

// URL inconnue sous une langue : la 404 s'affiche dans le layout traduit ([locale]/not-found.jsx)
// au lieu de la page d'erreur globale de Next, sans layout ni langue.
export default function CatchAllPage() {
  notFound();
}
