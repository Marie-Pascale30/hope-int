import "@/src/styles/globals.css";
import "@/src/styles/site.css";
import "@/src/styles/motion.css";
import "@/src/styles/glass.css";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AuthProvider } from "@/src/context/AuthContext";
import SourceTracker from "@/src/views/fundraising/components/SourceTracker";
import SiteFooter from "@/src/components/site/SiteFooter";
import SiteHeader from "@/src/components/site/SiteHeader";
import { FEATURE_FILES, loadMessages } from "@/src/i18n/messages";
import { routing } from "@/src/i18n/routing";
import { serverApi, settle } from "@/src/services/server";
import { SITE_NAME, SITE_URL, languageAlternates } from "@/src/views/site/seo";
import RootDocument, { appMetadata, rootViewport } from "../_lib/document";

// Layout racine du site public (et des pages de compte / don) : une arborescence par langue.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("home.absoluteTitle"), template: `%s · ${SITE_NAME}` },
    description: t("home.description"),
    applicationName: SITE_NAME,
    ...appMetadata,
    alternates: { languages: languageAlternates("/") },
  };
}

export const viewport = rootViewport;

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "nav" });
  // Messages envoyes au navigateur : habillage, site public et parcours de compte / don.
  const messages = await loadMessages(locale, ["common", "site", "account", ...FEATURE_FILES]);
  const { data: meta } = await settle(serverApi.meta(locale));

  return (
    <RootDocument locale={locale}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AuthProvider>
          {/* Conserve la source d'un don (?ref=) depuis la page d'arrivee jusqu'au formulaire de don. */}
          <Suspense fallback={null}>
            <SourceTracker />
          </Suspense>
          <div className="site-shell">
            <a href="#contenu" className="skip-link">{t("skip")}</a>
            <SiteHeader />
            <main id="contenu" className="site-main" tabIndex={-1}>{children}</main>
            <SiteFooter organization={meta?.organization} />
          </div>
        </AuthProvider>
      </NextIntlClientProvider>
    </RootDocument>
  );
}
