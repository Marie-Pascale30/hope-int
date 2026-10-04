import { setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import NewsView from "@/src/views/site/NewsView";
import { staticPageMetadata } from "@/src/views/site/seo";

export const revalidate = 60;

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "news", "/actualites");
}

export default async function NewsPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data, error } = await settle(serverApi.listContent("news", locale));
  return <NewsView news={data} error={Boolean(error)} />;
}
