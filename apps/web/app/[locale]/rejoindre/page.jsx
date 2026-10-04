import { setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import JoinView from "@/src/views/site/JoinView";
import { staticPageMetadata } from "@/src/views/site/seo";

export const revalidate = 60;

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "join", "/rejoindre");
}

export default async function JoinPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Sans referentiels (API indisponible), le formulaire reste utilisable sans region ni poles.
  const { data: meta } = await settle(serverApi.meta(locale));
  return <JoinView regions={meta?.regions || []} interestAreas={meta?.interestAreas || []} />;
}
