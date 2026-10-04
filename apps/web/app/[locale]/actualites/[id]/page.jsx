import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizePath } from "@/src/i18n/config";
import { serverApi, settle } from "@/src/services/server";
import LoadError from "@/src/views/site/components/LoadError";
import { loadDetail, loadForMetadata } from "@/src/views/site/detail";
import NewsDetailView from "@/src/views/site/NewsDetailView";
import { SITE_NAME, SITE_URL, absoluteUrl, buildMetadata, jsonLdProps, shareImage, truncateText } from "@/src/views/site/seo";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  const item = await loadForMetadata(serverApi.getContent("news", id, locale));
  return buildMetadata({
    locale,
    path: `/actualites/${id}`,
    title: item?.title || t("article.title"),
    description: truncateText(item?.summary || item?.content) || t("article.description"),
    image: item ? shareImage(item.image_url, item.title) : null,
    type: item ? "article" : "website",
    extra: item ? { openGraph: { publishedTime: item.created_at, modifiedTime: item.updated_at || item.created_at } } : {},
  });
}

export default async function NewsDetailPage({ params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { data: item, error } = await loadDetail(serverApi.getContent("news", id, locale));
  if (error) return <div className="container section"><LoadError /></div>;

  // Projet lie : facultatif, ignore s'il n'est plus publie.
  const { data: linked } = item.project_id
    ? await settle(serverApi.getContent("projects", item.project_id, locale))
    : { data: null };

  const image = shareImage(item.image_url, item.title);
  const article = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title,
    description: truncateText(item.summary || item.content),
    datePublished: item.created_at,
    dateModified: item.updated_at || item.created_at,
    mainEntityOfPage: absoluteUrl(localizePath(locale, `/actualites/${item.id}`)),
    ...(image ? { image: [image.url] } : {}),
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "NGO", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` } },
  };

  return (
    <>
      <script {...jsonLdProps(article)} />
      <NewsDetailView item={item} linked={linked} />
    </>
  );
}
