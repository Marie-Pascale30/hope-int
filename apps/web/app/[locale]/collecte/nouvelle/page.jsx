import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoadingState } from "@/src/components/ui";
import FundraiserFormView from "@/src/views/fundraising/FundraiserFormView";
import { buildMetadata } from "@/src/views/site/seo";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "fundraising.meta" });
  return buildMetadata({ locale, path: "/collecte/nouvelle", title: t("createTitle"), description: t("createDescription"), noindex: true });
}

export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<LoadingState />}>
      <FundraiserFormView />
    </Suspense>
  );
}
