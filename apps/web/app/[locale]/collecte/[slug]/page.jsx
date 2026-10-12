import { getTranslations, setRequestLocale } from "next-intl/server";
import { cleanSource } from "@hope/shared/fundraising";
import LoadError from "@/src/views/site/components/LoadError";
import FundraiserView from "@/src/views/fundraising/FundraiserView";
import { getFundraiser, loadFundraiser } from "@/src/views/fundraising/server";
import { absoluteUrl, buildMetadata, jsonLdProps, shareImage, truncateText } from "@/src/views/site/seo";
import { localizePath } from "@/src/i18n/config";

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "fundraising.page" });
  let fundraiser = null;
  try {
    fundraiser = await getFundraiser(slug, locale);
  } catch {
    fundraiser = null;
  }
  return buildMetadata({
    locale,
    path: `/collecte/${slug}`,
    title: fundraiser?.title || t("metaTitle"),
    description: truncateText(fundraiser?.story) || t("metaDescription"),
    image: fundraiser ? shareImage(fundraiser.image_url, fundraiser.title) : null,
    // Collecte cloturee : page conservee mais retiree des moteurs de recherche.
    noindex: !fundraiser || !fundraiser.open,
  });
}

export default async function FundraiserPage({ params, searchParams }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { data: fundraiser, error } = await loadFundraiser(slug, locale);
  if (error) return <div className="container section"><LoadError /></div>;
  const ref = (await searchParams)?.ref;
  const source = typeof ref === "string" && !/^[a-f0-9]{48}$/i.test(ref) ? cleanSource(ref) : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: fundraiser.title,
    description: truncateText(fundraiser.story),
    url: absoluteUrl(localizePath(locale, `/collecte/${fundraiser.slug}`)),
  };
  return (
    <>
      <script {...jsonLdProps(jsonLd)} />
      <FundraiserView fundraiser={fundraiser} source={source} />
    </>
  );
}
