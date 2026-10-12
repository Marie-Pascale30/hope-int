import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoadingState } from "@/src/components/ui";
import PledgeCreateView from "@/src/views/fundraising/PledgeCreateView";
import { buildMetadata } from "@/src/views/site/seo";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "fundraising.meta" });
  return buildMetadata({ locale, path: "/collecte/engagement", title: t("pledgeTitle"), description: t("pledgeDescription") });
}

export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<LoadingState />}>
      <PledgeCreateView />
    </Suspense>
  );
}
