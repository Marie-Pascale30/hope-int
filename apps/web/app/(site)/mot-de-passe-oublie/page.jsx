import { Suspense } from "react";
import { LoadingState } from "@/src/components/ui";
import ForgotPasswordView from "@/src/views/account/ForgotPasswordView";

export const metadata = {
  title: "Mot de passe oublié",
  description: "Recevez un lien pour réinitialiser votre mot de passe.",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ForgotPasswordView />
    </Suspense>
  );
}
