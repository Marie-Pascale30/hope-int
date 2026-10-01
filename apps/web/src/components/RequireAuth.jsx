"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/rbac";
import { Button, LoadingState, EmptyState } from "./ui";

// Protege une page : redirige vers la connexion si besoin, affiche un refus si une permission manque.
export default function RequireAuth({ children, permission, permissions = [] }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const required = permission ? [permission, ...permissions] : permissions;

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return <LoadingState label="Vérification de votre session…" />;
  }

  if (required.length && !can(user, ...required)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Accès réservé"
        description="Votre rôle ne donne pas accès à cette page. Si vous pensez que c'est une erreur, contactez un administrateur."
        action={<Button href="/">Retour à l’accueil</Button>}
      />
    );
  }

  return children;
}
