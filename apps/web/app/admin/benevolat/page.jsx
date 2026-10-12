import { getTranslations } from "next-intl/server";
import VolunteersAdmin from "@/src/views/volunteering/VolunteersAdmin";

export async function generateMetadata() {
  const t = await getTranslations("volunteering.volunteers");
  return { title: t("title") };
}

export default function Page() {
  return <VolunteersAdmin />;
}
