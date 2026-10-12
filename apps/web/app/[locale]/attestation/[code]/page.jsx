import { getTranslations, setRequestLocale } from "next-intl/server";
import CertificateVerifyView from "@/src/views/volunteering/CertificateVerifyView";
import { buildMetadata } from "@/src/views/site/seo";

// Page imprimee sur l'attestation PDF : confirme l'authenticite (nom, periode, heures).
export async function generateMetadata({ params }) {
  const { locale, code } = await params;
  const t = await getTranslations({ locale, namespace: "volunteering.verify" });
  return buildMetadata({
    locale,
    path: `/attestation/${encodeURIComponent(code)}`,
    title: t("metaTitle"),
    description: t("metaDescription"),
    noindex: true,
  });
}

export default async function Page({ params }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <CertificateVerifyView code={decodeURIComponent(code)} />;
}
