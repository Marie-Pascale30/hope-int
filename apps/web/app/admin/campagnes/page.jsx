import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/src/components/ui";
import CampaignsView from "@/src/views/engagement/admin/CampaignsView";

export async function generateMetadata() {
  const t = await getTranslations("engagement.meta");
  return { title: t("campaigns") };
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CampaignsView />
    </Suspense>
  );
}
