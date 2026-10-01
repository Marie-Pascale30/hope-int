import { Suspense } from "react";
import { LoadingState } from "@/src/components/ui";
import DonationThanksView from "@/src/views/account/DonationThanksView";

export const metadata = {
  title: "Merci pour votre don",
  description: "Confirmation de votre don à HOPE International et reçu à télécharger.",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DonationThanksView />
    </Suspense>
  );
}
