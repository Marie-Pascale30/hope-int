import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoadingState } from "@/src/components/ui";
import PreferencesView from "@/src/views/engagement/PreferencesView";
import { buildMetadata } from "@/src/views/site/seo";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engagement.meta.preferences" });
  return buildMetadata({ locale, path: "/preferences", title: t("title"), description: t("description"), noindex: true });
}

// Le jeton signe est lu dans l'URL (useSearchParams) : rendu sous Suspense.
export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <Suspense fallback={<LoadingState label={t("loading")} />}>
      <PreferencesView />
    </Suspense>
  );
}
