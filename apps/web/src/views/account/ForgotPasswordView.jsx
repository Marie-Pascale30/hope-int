"use client";

import "../../styles/account.css";
import { useState } from "react";
import { MailCheck, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Input } from "../../components/ui";
import { authApi } from "../../services";
import { Link } from "../../i18n/navigation";
import AuthCard from "./components/AuthCard";
import { EMAIL_PATTERN } from "./components/authHelpers";
import { useErrorMessage } from "../../i18n/errors";

export default function ForgotPasswordView() {
  const t = useTranslations("account.forgot");
  const tf = useTranslations("account.fields");
  const errorText = useErrorMessage();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState("");

  const emailError = submitted && !EMAIL_PATTERN.test(email.trim()) ? tf("emailInvalid") : undefined;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (!EMAIL_PATTERN.test(email.trim())) return;
    setLoading(true);
    try {
      const result = await authApi.forgotPassword(email.trim());
      setSentMessage(result?.message || t("sent"));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const footer = t.rich("remember", { link: (chunks) => <Link href="/connexion">{chunks}</Link> });

  if (sentMessage) {
    return (
      <AuthCard title={t("sentTitle")} footer={footer}>
        <div className="acc-auth__done">
          <span className="acc-auth__done-icon"><MailCheck size={28} aria-hidden="true" /></span>
          <p>{sentMessage}</p>
          <p className="muted">
            {t.rich("sentHelp", {
              button: (chunks) => (
                <button type="button" className="acc-link-button" onClick={() => setSentMessage("")}>
                  {chunks}
                </button>
              ),
            })}
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={footer}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Input
          label={tf("email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <Button type="submit" size="lg" block icon={Send} loading={loading}>
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
