import { getTranslations, setRequestLocale } from "next-intl/server";
import CertificateVerifyView from "@/src/views/volunteering/CertificateVerifyView";
import { buildMetadata } from "@/src/views/site/seo";

// Verification d'une attestation de benevolat (saisie du code imprime).
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "volunteering.verify" });
  return buildMetadata({ locale, path: "/attestation", title: t("metaTitle"), description: t("metaDescription"), noindex: true });
}

export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CertificateVerifyView />;
}
