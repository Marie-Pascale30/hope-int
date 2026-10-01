import { Suspense } from "react";
import { LoadingState } from "@/src/components/ui";
import ChangePasswordView from "@/src/views/account/ChangePasswordView";

export const metadata = {
  title: "Changer mon mot de passe",
  description: "Modifiez le mot de passe de votre compte HOPE International.",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ChangePasswordView />
    </Suspense>
  );
}
