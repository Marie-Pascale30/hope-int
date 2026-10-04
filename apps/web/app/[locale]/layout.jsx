import "@/src/styles/globals.css";
import "@/src/styles/site.css";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthProvider } from "@/src/context/AuthContext";
import SiteFooter from "@/src/components/site/SiteFooter";
import SiteHeader from "@/src/components/site/SiteHeader";
import { loadMessages } from "@/src/i18n/messages";
import { routing } from "@/src/i18n/routing";
import { serverApi, settle } from "@/src/services/server";
import { SITE_NAME, SITE_URL, languageAlternates } from "@/src/views/site/seo";
import RootDocument, { rootViewport } from "../_lib/document";

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
    manifest: "/manifest.json",
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
  const messages = await loadMessages(locale, ["common", "site", "account"]);
  const { data: meta } = await settle(serverApi.meta(locale));

  return (
    <RootDocument locale={locale}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AuthProvider>
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
