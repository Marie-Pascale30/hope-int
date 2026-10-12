import { getTranslations, setRequestLocale } from "next-intl/server";
import { settle } from "@/src/services/server";
import { transparencyServer } from "@/src/services/transparencyServer";
import TransparencyView, { TransparencyEmpty } from "@/src/views/transparency/TransparencyView";
import { buildMetadata } from "@/src/views/site/seo";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transparency.meta" });
  return buildMetadata({ locale, path: "/transparence", title: t("title"), description: t("description") });
}

// Derniere annee publiee par la direction ; etat vide tant qu'aucune ne l'est.
export default async function TransparencyPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const index = await settle(transparencyServer.index(locale));
  const latest = index.data?.latest;
  if (!latest) return <TransparencyEmpty index={index.data} error={Boolean(index.error)} />;
  const year = await settle(transparencyServer.year(latest, locale));
  if (year.error) return <TransparencyEmpty index={index.data} error />;
  return <TransparencyView data={year.data} />;
}

