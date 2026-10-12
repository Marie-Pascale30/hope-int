"use client";

// Chargement de la page (navigation cote client) : squelette du meme gabarit que la page.
import { ListPageSkeleton } from "@/src/views/site/components/PageSkeletons";

export default function Loading() {
  return <ListPageSkeleton variant="cards" />;
}
