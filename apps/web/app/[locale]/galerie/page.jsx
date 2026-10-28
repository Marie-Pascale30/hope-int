import { setRequestLocale } from "next-intl/server";
import GalleryView from "@/src/views/site/GalleryView";
import { shareImage, staticPageMetadata } from "@/src/views/site/seo";

// Contenu statique (catalogue de photos et dictionnaires) : page generee au build pour chaque langue.
export function generateMetadata({ params }) {
  return staticPageMetadata(params, "gallery", "/galerie", { image: shareImage("/images/livret/p11_00.jpg") });
}

export default async function GalleryPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GalleryView />;
}
