import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ServerApiError } from "@/src/services/server";
import { transparencyServer } from "@/src/services/transparencyServer";
import LoadError from "@/src/views/site/components/LoadError";
import TransparencyView from "@/src/views/transparency/TransparencyView";
import { parseYear } from "@/src/views/transparency/helpers";
import { buildMetadata } from "@/src/views/site/seo";

export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { locale, year } = await params;
  const t = await getTranslations({ locale, namespace: "transparency.meta" });
  return buildMetadata({
    locale,
    path: `/transparence/${year}`,
    title: t("yearTitle", { year: String(year) }),
    description: t("yearDescription", { year: String(year) }),
  });
}

// Annee non publiee (ou invalide) : vraie 404, aucun chiffre non valide n'est expose.
export default async function TransparencyYearPage({ params }) {
  const { locale, year } = await params;
  setRequestLocale(locale);
  if (!parseYear(year)) notFound();
  let data;
  try {
    data = await transparencyServer.year(year, locale);
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 404 || error.status === 400)) notFound();
    return <div className="container section"><LoadError /></div>;
  }
  return <TransparencyView data={data} />;
}
