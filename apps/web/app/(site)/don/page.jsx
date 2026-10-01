import { Suspense } from "react";
import { LoadingState } from "@/src/components/ui";
import DonateView from "@/src/views/account/DonateView";

export const metadata = {
  title: "Faire un don",
  description: "Soutenez les familles camerounaises : microcrédit solidaire, formation et entraide. Don ponctuel ou mensuel, par carte bancaire ou Mobile Money, reçu envoyé par email.",
};

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DonateView />
    </Suspense>
  );
}
