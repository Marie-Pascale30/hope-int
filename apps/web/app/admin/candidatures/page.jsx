import { Suspense } from "react";
import { PageSkeleton } from "@/src/components/ui";
import { adminPageMetadata } from "../_lib/metadata";
import Applications from "@/src/views/admin/Applications";

export const generateMetadata = adminPageMetadata("applications");

// Filtres conserves dans l'URL (useSearchParams) : rendu sous Suspense.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Applications />
    </Suspense>
  );
}
