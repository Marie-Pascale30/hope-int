"use client";

import "../../styles/account.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button, Input, LoadingState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services";
import { Link, useLocalePath } from "../../i18n/navigation";
import AuthCard from "./components/AuthCard";
import { PasswordInput, PasswordStrength } from "./components/PasswordFields";
import { EMAIL_PATTERN, destinationFor, isStrongPassword } from "./components/authHelpers";
import { useErrorMessage } from "../../i18n/errors";
import ConsentCheckboxes, { initialConsents } from "../engagement/ConsentCheckboxes";
import "../engagement/engagement.css";

const EMPTY = { name: "", email: "", password: "", confirm: "" };

// tf : traducteur de account.fields.
function validate(form, tf) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = tf("nameMin", { min: 2 });
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = tf("emailInvalid");
  if (!isStrongPassword(form.password)) errors.password = tf("passwordRules");
  if (form.confirm !== form.password) errors.confirm = tf("passwordMismatch");
  return errors;
}

export default function RegisterView() {
  const { status, user } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("account.register");
  const tf = useTranslations("account.fields");
  const errorText = useErrorMessage();
  const lp = useLocalePath();
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [consents, setConsents] = useState(initialConsents);

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(destinationFor(user, null, locale));
  }, [status, user, router, locale]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const errors = submitted ? validate(form, tf) : {};

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.keys(validate(form, tf)).length) return;
    setLoading(true);
    const email = form.email.trim().toLowerCase();
    try {
      // Reponse volontairement neutre (201 meme si l'email existe deja) : pas de connexion
      // automatique. Un compte cree est invite et recoit un email de bienvenue ; le titulaire
      // d'un compte existant recoit un avertissement.
      await authApi.register({ name: form.name.trim(), email, password: form.password, consents });
      setSentTo(email);
      setForm(EMPTY);
      setSubmitted(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  if (status === "authenticated") {
    return <LoadingState label={t("opening")} />;
  }

  if (sentTo) {
    return (
      <AuthCard
        title={t("sentTitle")}
        description={t("sentDescription")}
        footer={t.rich("hasAccount", { link: (chunks) => <Link href="/connexion">{chunks}</Link> })}
      >
        <div className="stack" aria-live="polite">
          <Alert tone="success" title={t("sentAlertTitle")}>
            {t.rich("sentText", { email: sentTo, strong: (chunks) => <strong>{chunks}</strong> })}
          </Alert>
          <p className="muted acc-small">{t("sentHelp")}</p>
          <Button href={lp(`/connexion?email=${encodeURIComponent(sentTo)}`)} size="lg" block icon={LogIn}>
            {t("sentLogin")}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={t.rich("hasAccount", { link: (chunks) => <Link href="/connexion">{chunks}</Link> })}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label={tf("fullName")} autoComplete="name" enterKeyHint="next" required value={form.name} onChange={set("name")} error={errors.name} />
        <Input
          label={tf("email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="next"
          required
          value={form.email}
          onChange={set("email")}
          error={errors.email}
        />
        <PasswordInput
          label={tf("password")}
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set("password")}
          error={errors.password}
        />
        <PasswordStrength password={form.password} />
        <PasswordInput
          label={tf("confirmPassword")}
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set("confirm")}
          error={errors.confirm || (form.confirm && form.confirm !== form.password ? tf("passwordMismatch") : undefined)}
        />
        <ConsentCheckboxes value={consents} onChange={setConsents} />
        <Button type="submit" size="lg" block icon={UserPlus} loading={loading}>
          {t("submit")}
        </Button>
        <p className="acc-auth__note">
          {t.rich("teamNote", { link: (chunks) => <Link href="/rejoindre">{chunks}</Link> })}
        </p>
      </form>
    </AuthCard>
  );
}
