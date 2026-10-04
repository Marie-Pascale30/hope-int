import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoadingState } from "@/src/components/ui";
import ForgotPasswordView from "@/src/views/account/ForgotPasswordView";
import { staticPageMetadata } from "@/src/views/site/seo";

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "forgotPassword", "/mot-de-passe-oublie", { noindex: true });
}

export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <Suspense fallback={<LoadingState label={t("loading")} />}>
      <ForgotPasswordView />
    </Suspense>
  );
}
