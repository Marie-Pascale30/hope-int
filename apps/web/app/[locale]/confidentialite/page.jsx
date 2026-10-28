import { getTranslations, setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import { PrivacyPolicyView } from "@/src/views/site/LegalView";
import { buildMetadata } from "@/src/views/site/seo";

// Contenu statique (dictionnaires) et coordonnees de GET /meta, regenere toutes les heures.
export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy.meta" });
  return buildMetadata({ locale, path: "/confidentialite", title: t("title"), description: t("description") });
}

export default async function PrivacyPolicyPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data: meta } = await settle(serverApi.meta(locale));
  return <PrivacyPolicyView organization={meta?.organization} />;
}
