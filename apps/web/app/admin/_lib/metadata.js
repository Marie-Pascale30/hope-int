import { getTranslations } from "next-intl/server";

// Titre d'une page du back-office : cle des messages "admin.nav" (langue du cookie NEXT_LOCALE).
export function adminPageMetadata(key) {
  return async function generateMetadata() {
    const t = await getTranslations("admin.nav");
    return { title: t(key) };
  };
}
