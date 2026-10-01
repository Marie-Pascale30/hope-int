import { Suspense } from "react";
import { LoadingState } from "@/src/components/ui";
import AccountView from "@/src/views/account/AccountView";

export const metadata = {
  title: "Mon espace",
  description: "Vos dons, reçus, événements et informations de profil.",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AccountView />
    </Suspense>
  );
}
