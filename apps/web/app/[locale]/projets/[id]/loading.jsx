"use client";

// Chargement de la page (navigation cote client) : squelette du meme gabarit que la page.
import { DetailPageSkeleton } from "@/src/views/site/components/PageSkeletons";

export default function Loading() {
  return <DetailPageSkeleton variant="aside" />;
}
