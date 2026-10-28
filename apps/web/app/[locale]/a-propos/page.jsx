import { setRequestLocale } from "next-intl/server";
import AboutView from "@/src/views/site/AboutView";
import { staticPageMetadata } from "@/src/views/site/seo";

// Contenu statique (dictionnaires) : page generee au build pour chaque langue.
export function generateMetadata({ params }) {
  return staticPageMetadata(params, "about", "/a-propos");
}

export default async function AboutPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AboutView />;
}
