import { getTranslations, setRequestLocale } from "next-intl/server";
import OfflineView from "@/src/views/transparency/OfflineView";
import { buildMetadata } from "@/src/views/site/seo";

// Page de repli du service worker : non indexee.
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transparency.meta" });
  return buildMetadata({ locale, path: "/hors-ligne", title: t("offlineTitle"), description: t("offlineDescription"), noindex: true });
}

export default async function OfflinePage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OfflineView />;
}
