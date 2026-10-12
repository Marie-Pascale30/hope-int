import { Suspense } from "react";
import { PageSkeleton } from "@/src/components/ui";
import { adminPageMetadata } from "../_lib/metadata";
import Members from "@/src/views/admin/Members";

export const generateMetadata = adminPageMetadata("members");

// Filtres conserves dans l'URL (useSearchParams) : rendu sous Suspense.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Members />
    </Suspense>
  );
}
