"use client";

import "../../styles/account.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Alert, Button, Input, LoadingState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { toast } from "../../utils/alerts";
import AuthCard from "./components/AuthCard";
import { PasswordInput, PasswordStrength } from "./components/PasswordFields";
import { EMAIL_PATTERN, destinationFor, isStrongPassword } from "./components/authHelpers";

const EMPTY = { name: "", email: "", password: "", confirm: "" };

function validate(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = "Indiquez votre nom (2 caractères minimum)";
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Adresse email invalide";
  if (!isStrongPassword(form.password)) errors.password = "Le mot de passe ne respecte pas encore les règles ci-dessous";
  if (form.confirm !== form.password) errors.confirm = "Les mots de passe ne correspondent pas";
  return errors;
}

export default function RegisterView() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(destinationFor(user));
  }, [status, user, router]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const errors = submitted ? validate(form) : {};

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.keys(validate(form)).length) return;
    setLoading(true);
    const email = form.email.trim().toLowerCase();
    try {
      await authApi.register({ name: form.name.trim(), email, password: form.password });
      await login(email, form.password);
      toast("Bienvenue chez HOPE International !");
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  if (status === "authenticated") {
    return <LoadingState label="Ouverture de votre espace…" />;
  }

  return (
    <AuthCard
      title="Créer votre compte"
      description="Suivez vos dons, téléchargez vos reçus et inscrivez-vous à nos événements solidaires."
      footer={
        <>
          Déjà inscrit ? <Link href="/connexion">Se connecter</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label="Nom complet" autoComplete="name" required value={form.name} onChange={set("name")} error={errors.name} />
        <Input
          label="Adresse email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={form.email}
          onChange={set("email")}
          error={errors.email}
        />
        <PasswordInput
          label="Mot de passe"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set("password")}
          error={errors.password}
        />
        <PasswordStrength password={form.password} />
        <PasswordInput
          label="Confirmez le mot de passe"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set("confirm")}
          error={errors.confirm || (form.confirm && form.confirm !== form.password ? "Les mots de passe ne correspondent pas" : undefined)}
        />
        <Button type="submit" size="lg" block icon={UserPlus} loading={loading}>
          Créer mon compte
        </Button>
        <p className="acc-auth__note">
          Vous souhaitez rejoindre l’équipe de HOPE International (bénévole, salarié, responsable régional) ? Le compte
          membre ne suffit pas : <Link href="/rejoindre">déposez votre candidature</Link>, nous vous recontacterons.
        </p>
      </form>
    </AuthCard>
  );
}
