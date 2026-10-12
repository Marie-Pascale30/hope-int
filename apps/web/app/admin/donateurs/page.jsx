import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/src/components/ui";
import DonorsView from "@/src/views/engagement/admin/DonorsView";

export async function generateMetadata() {
  const t = await getTranslations("engagement.meta");
  return { title: t("donors") };
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DonorsView />
    </Suspense>
  );
}
