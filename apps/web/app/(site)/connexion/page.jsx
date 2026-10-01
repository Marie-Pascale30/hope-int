import { Suspense } from "react";
import { LoadingState } from "@/src/components/ui";
import LoginView from "@/src/views/account/LoginView";

export const metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre espace HOPE International.",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginView />
    </Suspense>
  );
}
