import { Suspense } from "react";
import { PageSkeleton } from "@/src/components/ui";
import { adminPageMetadata } from "../_lib/metadata";
import Messages from "@/src/views/admin/Messages";

export const generateMetadata = adminPageMetadata("messages");

// Filtres conserves dans l'URL (useSearchParams) : rendu sous Suspense.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Messages />
    </Suspense>
  );
}
