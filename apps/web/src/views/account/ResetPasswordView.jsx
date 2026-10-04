"use client";

import "../../styles/account.css";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, LinkIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button } from "../../components/ui";
import { authApi } from "../../services";
import { localizePath } from "../../i18n/config";
import { Link } from "../../i18n/navigation";
import AuthCard from "./components/AuthCard";
import { PasswordInput, PasswordStrength } from "./components/PasswordFields";
import { isStrongPassword } from "./components/authHelpers";
import { useErrorMessage } from "../../i18n/errors";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

// Code renvoye par l'API pour un jeton invalide, expire ou deja utilise.
const LINK_INVALID_CODE = "RESET_LINK_INVALID";

function InvalidLink({ message }) {
  const t = useTranslations("account.reset");
  const locale = useLocale();
  return (
    <AuthCard title={t("invalidTitle")}>
      <div className="acc-auth__done">
        <span className="acc-auth__done-icon acc-auth__done-icon--warning"><LinkIcon size={26} aria-hidden="true" /></span>
        <p>{message || t("invalidText")}</p>
        <Button href={localizePath(locale, "/mot-de-passe-oublie")} block>{t("newRequest")}</Button>
        <Link href="/connexion" className="acc-auth__secondary-link">{t("backToLogin")}</Link>
      </div>
    </AuthCard>
  );
}

export default function ResetPasswordView() {
  const token = useSearchParams().get("token") || "";
  const t = useTranslations("account.reset");
  const tf = useTranslations("account.fields");
  const locale = useLocale();
  const errorText = useErrorMessage();
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
      <AuthCard title={t("doneTitle")}>
        <div className="acc-auth__done">
          <span className="acc-auth__done-icon"><CheckCircle2 size={28} aria-hidden="true" /></span>
          <p>{t("doneText")}</p>
          <Button href={localizePath(locale, "/connexion")} size="lg" block>{t("login")}</Button>
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
      const message = errorText(err);
      if (err?.response?.data?.code === LINK_INVALID_CODE) setInvalid(message);
      else setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={<Link href="/connexion">{t("backToLogin")}</Link>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <PasswordInput
          label={tf("newPassword")}
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set("password")}
          error={submitted && !isStrongPassword(form.password) ? tf("passwordRules") : undefined}
        />
        <PasswordStrength password={form.password} />
        <PasswordInput
          label={tf("confirmPassword")}
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set("confirm")}
          error={mismatch || (submitted && !form.confirm) ? tf("passwordMismatch") : undefined}
        />
        <Button type="submit" size="lg" block icon={KeyRound} loading={loading}>
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
