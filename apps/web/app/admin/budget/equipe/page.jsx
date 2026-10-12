import { getTranslations } from "next-intl/server";
import TeamAdmin from "@/src/views/transparency/admin/TeamAdmin";

export async function generateMetadata() {
  const t = await getTranslations("transparency.admin.tabs");
  return { title: t("team") };
}

export default function Page() {
  return <TeamAdmin />;
}
