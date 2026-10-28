import { getTranslations, setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import { LegalNoticeView } from "@/src/views/site/LegalView";
import { buildMetadata } from "@/src/views/site/seo";

// Contenu statique (dictionnaires) et coordonnees de GET /meta, regenere toutes les heures.
export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.notice.meta" });
  return buildMetadata({ locale, path: "/mentions-legales", title: t("title"), description: t("description") });
}

export default async function LegalNoticePage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data: meta } = await settle(serverApi.meta(locale));
  return <LegalNoticeView organization={meta?.organization} />;
}
