"use client";

import "../../styles/account.css";
import { useState } from "react";
import Link from "next/link";
import { MailCheck, Send } from "lucide-react";
import { Alert, Button, Input } from "../../components/ui";
import { authApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import AuthCard from "./components/AuthCard";
import { EMAIL_PATTERN } from "./components/authHelpers";

export default function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState("");

  const emailError = submitted && !EMAIL_PATTERN.test(email.trim()) ? "Adresse email invalide" : undefined;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (!EMAIL_PATTERN.test(email.trim())) return;
    setLoading(true);
    try {
      const result = await authApi.forgotPassword(email.trim());
      setSentMessage(result?.message || "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      Vous vous en souvenez ? <Link href="/connexion">Retour à la connexion</Link>
    </>
  );

  if (sentMessage) {
    return (
      <AuthCard title="Vérifiez votre boîte mail" footer={footer}>
        <div className="acc-auth__done">
          <span className="acc-auth__done-icon"><MailCheck size={28} aria-hidden="true" /></span>
          <p>{sentMessage}</p>
          <p className="muted">
            Le lien est valable 1 heure. Pensez à regarder dans vos courriers indésirables. Rien reçu ?{" "}
            <button type="button" className="acc-link-button" onClick={() => setSentMessage("")}>
              Faire une nouvelle demande
            </button>
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indiquez l’adresse email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      footer={footer}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Input
          label="Adresse email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <Button type="submit" size="lg" block icon={Send} loading={loading}>
          Recevoir le lien
        </Button>
      </form>
    </AuthCard>
  );
}
