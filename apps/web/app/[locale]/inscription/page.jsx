import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoadingState } from "@/src/components/ui";
import RegisterView from "@/src/views/account/RegisterView";
import { staticPageMetadata } from "@/src/views/site/seo";

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "register", "/inscription", { noindex: true });
}

export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <Suspense fallback={<LoadingState label={t("loading")} />}>
      <RegisterView />
    </Suspense>
  );
}
