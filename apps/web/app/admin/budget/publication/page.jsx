import { getTranslations } from "next-intl/server";
import PublicationAdmin from "@/src/views/transparency/admin/PublicationAdmin";

export async function generateMetadata() {
  const t = await getTranslations("transparency.admin.tabs");
  return { title: t("publication") };
}

export default function Page() {
  return <PublicationAdmin />;
}
