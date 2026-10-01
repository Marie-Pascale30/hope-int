import { Suspense } from "react";
import { LoadingState } from "@/src/components/ui";
import RegisterView from "@/src/views/account/RegisterView";

export const metadata = {
  title: "Créer un compte",
  description: "Créez votre compte donateur ou membre HOPE International.",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RegisterView />
    </Suspense>
  );
}
