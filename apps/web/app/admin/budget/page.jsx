import { getTranslations } from "next-intl/server";
import BudgetAdmin from "@/src/views/transparency/admin/BudgetAdmin";

export async function generateMetadata() {
  const t = await getTranslations("transparency.admin.tabs");
  return { title: t("budget") };
}

export default function Page() {
  return <BudgetAdmin />;
}
