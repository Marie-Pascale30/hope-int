import { Suspense } from "react";
import { LoadingState } from "@/src/components/ui";
import ResetPasswordView from "@/src/views/account/ResetPasswordView";

export const metadata = {
  title: "Nouveau mot de passe",
  description: "Choisissez un nouveau mot de passe pour votre compte.",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResetPasswordView />
    </Suspense>
  );
}
