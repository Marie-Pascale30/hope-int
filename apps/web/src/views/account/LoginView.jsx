"use client";

import "../../styles/account.css";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button, Input, LoadingState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { Link } from "../../i18n/navigation";
import AuthCard from "./components/AuthCard";
import { PasswordInput } from "./components/PasswordFields";
import { EMAIL_PATTERN, destinationFor, safeNext } from "./components/authHelpers";
import { useErrorMessage } from "../../i18n/errors";

export default function LoginView() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("account.login");
  const tf = useTranslations("account.fields");
  const errorText = useErrorMessage();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const expired = params.get("expired") === "1";

  const [form, setForm] = useState({ email: "", password: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Deja connecte (ou connexion reussie) : redirection vers la bonne page.
  useEffect(() => {
    if (status === "authenticated" && user) router.replace(destinationFor(user, next, locale));
  }, [status, user, next, router, locale]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const emailError = submitted && !EMAIL_PATTERN.test(form.email.trim()) ? tf("emailInvalid") : undefined;
  const passwordError = submitted && !form.password ? tf("passwordRequired") : undefined;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (!EMAIL_PATTERN.test(form.email.trim()) || !form.password) return;
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  };

  if (status === "authenticated") {
    return <LoadingState label={t("redirecting")} />;
  }

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={t.rich("noAccount", { link: (chunks) => <Link href="/inscription">{chunks}</Link> })}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {expired && (
          <Alert tone="warning" title={t("expiredTitle")}>
            {t("expiredText")}
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <Input
          label={tf("email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={form.email}
          onChange={set("email")}
          error={emailError}
        />
        <PasswordInput label={tf("password")} required value={form.password} onChange={set("password")} error={passwordError} />
        <div className="acc-auth__aside">
          <Link href="/mot-de-passe-oublie">{t("forgot")}</Link>
        </div>
        <Button type="submit" size="lg" block icon={LogIn} loading={loading}>
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
