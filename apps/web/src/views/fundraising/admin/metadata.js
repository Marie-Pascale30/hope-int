import { getTranslations } from "next-intl/server";

// Titre d'une page du back-office de la collecte : cle "fundraising.admin.nav.<key>".
export function fundraisingAdminMetadata(key) {
  return async function generateMetadata() {
    const t = await getTranslations("fundraising.admin.nav");
    return { title: t(key) };
  };
}
