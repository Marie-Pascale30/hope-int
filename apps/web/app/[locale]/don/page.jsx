import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoadingState } from "@/src/components/ui";
import DonateView from "@/src/views/account/DonateView";
import { staticPageMetadata } from "@/src/views/site/seo";

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "donate", "/don");
}

export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <Suspense fallback={<LoadingState label={t("loading")} />}>
      <DonateView />
    </Suspense>
  );
}
