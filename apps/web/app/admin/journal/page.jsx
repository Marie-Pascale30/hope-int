import { Suspense } from "react";
import { PageSkeleton } from "@/src/components/ui";
import { adminPageMetadata } from "../_lib/metadata";
import Logs from "@/src/views/admin/Logs";

export const generateMetadata = adminPageMetadata("logs");

// Filtres conserves dans l'URL (useSearchParams) : rendu sous Suspense.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Logs />
    </Suspense>
  );
}
