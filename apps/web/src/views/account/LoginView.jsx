"use client";

import "../../styles/account.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { Alert, Button, Input, LoadingState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage } from "../../services/api";
import AuthCard from "./components/AuthCard";
import { PasswordInput } from "./components/PasswordFields";
import { EMAIL_PATTERN, destinationFor, safeNext } from "./components/authHelpers";

export default function LoginView() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const expired = params.get("expired") === "1";

  const [form, setForm] = useState({ email: "", password: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Deja connecte (ou connexion reussie) : redirection vers la bonne page.
  useEffect(() => {
    if (status === "authenticated" && user) router.replace(destinationFor(user, next));
  }, [status, user, next, router]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const emailError = submitted && !EMAIL_PATTERN.test(form.email.trim()) ? "Adresse email invalide" : undefined;
  const passwordError = submitted && !form.password ? "Indiquez votre mot de passe" : undefined;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (!EMAIL_PATTERN.test(form.email.trim()) || !form.password) return;
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  if (status === "authenticated") {
    return <LoadingState label="Redirection vers votre espace…" />;
  }

  return (
    <AuthCard
      title="Bon retour parmi nous"
      description="Connectez-vous pour retrouver vos dons, vos reçus et vos inscriptions aux événements."
      footer={
        <>
          Pas encore de compte ? <Link href="/inscription">Créer un compte</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        {expired && (
          <Alert tone="warning" title="Session expirée">
            Pour votre sécurité, vous avez été déconnecté. Reconnectez-vous pour continuer.
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <Input
          label="Adresse email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={form.email}
          onChange={set("email")}
          error={emailError}
        />
        <PasswordInput label="Mot de passe" required value={form.password} onChange={set("password")} error={passwordError} />
        <div className="acc-auth__aside">
          <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </div>
        <Button type="submit" size="lg" block icon={LogIn} loading={loading}>
          Se connecter
        </Button>
      </form>
    </AuthCard>
  );
}
