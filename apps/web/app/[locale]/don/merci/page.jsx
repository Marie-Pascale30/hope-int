import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoadingState } from "@/src/components/ui";
import DonationThanksView from "@/src/views/account/DonationThanksView";
import { staticPageMetadata } from "@/src/views/site/seo";

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "thanks", "/don/merci", { noindex: true });
}

export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <Suspense fallback={<LoadingState label={t("loading")} />}>
      <DonationThanksView />
    </Suspense>
  );
}
