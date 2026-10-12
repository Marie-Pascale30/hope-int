import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoadingState } from "@/src/components/ui";
import NewsletterConfirmView from "@/src/views/engagement/NewsletterConfirmView";
import { buildMetadata } from "@/src/views/site/seo";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engagement.meta.newsletterConfirm" });
  return buildMetadata({ locale, path: "/newsletter/confirmer", title: t("title"), description: t("description"), noindex: true });
}

export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <Suspense fallback={<LoadingState label={t("loading")} />}>
      <NewsletterConfirmView />
    </Suspense>
  );
}
