"use client";

import "../../styles/account.css";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, LinkIcon } from "lucide-react";
import { Alert, Button } from "../../components/ui";
import { authApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import AuthCard from "./components/AuthCard";
import { PasswordInput, PasswordStrength } from "./components/PasswordFields";
import { isStrongPassword } from "./components/authHelpers";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function InvalidLink({ message }) {
  return (
    <AuthCard title="Lien invalide ou expiré">
      <div className="acc-auth__done">
        <span className="acc-auth__done-icon acc-auth__done-icon--warning"><LinkIcon size={26} aria-hidden="true" /></span>
        <p>{message || "Ce lien de réinitialisation est incomplet, a déjà été utilisé ou a expiré (il est valable 1 heure)."}</p>
        <Button href="/mot-de-passe-oublie" block>Faire une nouvelle demande</Button>
        <Link href="/connexion" className="acc-auth__secondary-link">Retour à la connexion</Link>
      </div>
    </AuthCard>
  );
}

export default function ResetPasswordView() {
  const token = useSearchParams().get("token") || "";
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!TOKEN_PATTERN.test(token)) return <InvalidLink />;
  if (invalid) return <InvalidLink message={invalid} />;

  if (done) {
    return (
      <AuthCard title="Mot de passe réinitialisé">
        <div className="acc-auth__done">
          <span className="acc-auth__done-icon"><CheckCircle2 size={28} aria-hidden="true" /></span>
          <p>Votre nouveau mot de passe est enregistré. Vous pouvez dès maintenant vous connecter avec celui-ci.</p>
          <Button href="/connexion" size="lg" block>Se connecter</Button>
        </div>
      </AuthCard>
    );
  }

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const mismatch = form.confirm && form.confirm !== form.password;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (!isStrongPassword(form.password) || form.password !== form.confirm) return;
    setLoading(true);
    try {
      await authApi.resetPassword({ token, password: form.password });
      setDone(true);
    } catch (err) {
      const message = getErrorMessage(err);
      // 400 sur le jeton : lien expire ou deja utilise.
      if (err?.response?.status === 400 && /lien/i.test(message)) setInvalid(message);
      else setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Choisir un nouveau mot de passe"
      description="Pour sécuriser votre compte, choisissez un mot de passe que vous n’utilisez nulle part ailleurs."
      footer={<Link href="/connexion">Retour à la connexion</Link>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <PasswordInput
          label="Nouveau mot de passe"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set("password")}
          error={submitted && !isStrongPassword(form.password) ? "Le mot de passe ne respecte pas encore les règles ci-dessous" : undefined}
        />
        <PasswordStrength password={form.password} />
        <PasswordInput
          label="Confirmez le mot de passe"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set("confirm")}
          error={mismatch || (submitted && !form.confirm) ? "Les mots de passe ne correspondent pas" : undefined}
        />
        <Button type="submit" size="lg" block icon={KeyRound} loading={loading}>
          Enregistrer mon mot de passe
        </Button>
      </form>
    </AuthCard>
  );
}
