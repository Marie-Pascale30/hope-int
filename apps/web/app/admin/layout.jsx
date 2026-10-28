import "@/src/styles/globals.css";
import "@/src/styles/site.css";
import "@/src/styles/admin.css";
import "@/src/styles/admin-pages.css";
import "@/src/styles/glass.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import AdminShell from "@/src/components/admin/AdminShell";
import { AuthProvider } from "@/src/context/AuthContext";
import { FEATURE_FILES, loadMessages } from "@/src/i18n/messages";
import RootDocument, { appMetadata, rootViewport } from "../_lib/document";

// Layout racine du back-office : pas de prefixe de langue dans l'URL, la langue vient
// du cookie de preference NEXT_LOCALE (voir src/i18n/request.js). Memes dictionnaires
// et memes API (useTranslations / getTranslations) que le site public.
export async function generateMetadata() {
  const t = await getTranslations("admin.meta");
  return {
    title: { default: t("title"), template: t("template") },
    robots: { index: false, follow: false },
    ...appMetadata,
  };
}


export const viewport = rootViewport;

export default async function AdminLayout({ children }) {
  const locale = await getLocale();
  const [messages, siteMessages] = await Promise.all([
    loadMessages(locale, ["common", "admin", "adminOps", ...FEATURE_FILES]),
    loadMessages(locale, ["site"]),
  ]);
  // Editeur des galeries photos (projets, actualites) : seuls les textes des albums du livret
  // (site.gallery) sont repris du site public, pas tout le dictionnaire.
  messages.site = { gallery: siteMessages.site.gallery };
  return (
    <RootDocument locale={locale}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AuthProvider>
          <AdminShell>{children}</AdminShell>
        </AuthProvider>
      </NextIntlClientProvider>
    </RootDocument>
  );
}
