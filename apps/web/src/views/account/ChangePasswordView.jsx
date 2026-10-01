"use client";

import "../../styles/account.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { isStaff } from "../../utils/rbac";
import AuthCard from "./components/AuthCard";
import ChangePasswordForm from "./components/ChangePasswordForm";

function ChangePasswordContent() {
  const { user } = useAuth();
  const router = useRouter();
  const required = user?.mustChangePassword;

  return (
    <AuthCard
      title={required ? "Choisissez votre mot de passe" : "Changer mon mot de passe"}
      description={
        required
          ? "Pour sécuriser votre compte, choisissez votre mot de passe personnel. Le mot de passe provisoire reçu par email ne fonctionnera plus ensuite."
          : "Votre nouveau mot de passe remplacera l’actuel sur tous vos appareils."
      }
      footer={required ? undefined : <Link href="/espace">Retour à mon espace</Link>}
    >
      {required && (
        <div className="acc-auth__alert">
          <Alert tone="info" title={`Bienvenue, ${user.name.split(" ")[0]}`}>
            Cette étape est obligatoire avant d’accéder à votre espace.
          </Alert>
        </div>
      )}
      <ChangePasswordForm
        submitLabel={required ? "Enregistrer et continuer" : "Mettre à jour le mot de passe"}
        onDone={(nextUser) => router.replace(isStaff(nextUser) ? "/admin" : "/espace")}
      />
    </AuthCard>
  );
}

export default function ChangePasswordView() {
  return (
    <RequireAuth>
      <ChangePasswordContent />
    </RequireAuth>
  );
}
