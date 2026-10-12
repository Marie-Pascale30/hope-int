import { getTranslations } from "next-intl/server";
import ReviewQueue from "@/src/views/volunteering/ReviewQueue";

export async function generateMetadata() {
  const t = await getTranslations("volunteering.review");
  return { title: t("title") };
}

export default function Page() {
  return <ReviewQueue />;
}
