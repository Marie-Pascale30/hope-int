import { Suspense } from "react";
import { PageSkeleton } from "@/src/components/ui";
import { adminPageMetadata } from "../_lib/metadata";
import Donations from "@/src/views/admin/Donations";

export const generateMetadata = adminPageMetadata("donations");

// Filtres conserves dans l'URL (useSearchParams) : rendu sous Suspense.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Donations />
    </Suspense>
  );
}
