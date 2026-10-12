import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoadingState } from "@/src/components/ui";
import PledgeManageView from "@/src/views/fundraising/PledgeManageView";
import { buildMetadata } from "@/src/views/site/seo";

// Lien personnel (jeton secret) : jamais indexe.
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "fundraising.meta" });
  return buildMetadata({ locale, path: "/collecte/engagement", title: t("pledgeManageTitle"), description: t("pledgeDescription"), noindex: true });
}

export default async function Page({ params }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<LoadingState />}>
      <PledgeManageView token={token} />
    </Suspense>
  );
}
