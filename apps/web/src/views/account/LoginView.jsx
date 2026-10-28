"use client";

import "../../styles/account.css";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LogIn, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button, Input, LoadingState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services";
import { setSessionHint } from "../../services/api";
import { Link } from "../../i18n/navigation";
import AuthCard from "./components/AuthCard";
import { PasswordInput } from "./components/PasswordFields";
import { EMAIL_PATTERN, destinationFor, safeNext } from "./components/authHelpers";
import { useErrorMessage } from "../../i18n/errors";

const CODE_PATTERN = /^\d{6}$/;

export default function LoginView() {
  const { status, user, updateSession } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("account.login");
  const tf = useTranslations("account.fields");
  const errorText = useErrorMessage();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const expired = params.get("expired") === "1";

  const [form, setForm] = useState(() => ({ email: params.get("email") || "", password: "" }));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Seconde etape (comptes de l'equipe) : code a 6 chiffres recu par email.
  const [challenge, setChallenge] = useState(null);

  // Deja connecte (ou connexion reussie) : redirection vers la bonne page.
  useEffect(() => {
    if (status === "authenticated" && user) router.replace(destinationFor(user, next, locale));
  }, [status, user, next, router, locale]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const emailError = submitted && !EMAIL_PATTERN.test(form.email.trim()) ? tf("emailInvalid") : undefined;
  const passwordError = submitted && !form.password ? tf("passwordRequired") : undefined;

  const finish = (sessionUser) => {
    setSessionHint(true);
    updateSession(sessionUser);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (!EMAIL_PATTERN.test(form.email.trim()) || !form.password) return;
    setLoading(true);
    try {
      const result = await authApi.login({ email: form.email.trim(), password: form.password });
      if (result.mfaRequired) {
        setChallenge({ token: result.challenge, resendIn: result.resendIn || 60 });
        setLoading(false);
        return;
      }
      finish(result.user);
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  };

  // Retour au formulaire : nouvelle connexion complete (mot de passe a ressaisir).
  const backToPassword = (message = "") => {
    setChallenge(null);
    setForm((prev) => ({ ...prev, password: "" }));
    setSubmitted(false);
    setError(message);
  };

  if (status === "authenticated") {
    return <LoadingState label={t("redirecting")} />;
  }

  if (challenge) {
    return (
      <LoginCodeStep
        key={challenge.token}
        challenge={challenge}
        email={form.email.trim()}
        onSuccess={finish}
        onBack={backToPassword}
      />
    );
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
          autoComplete="username"
          inputMode="email"
          enterKeyHint="next"
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

// Seconde etape : saisie du code, appareil de confiance, renvoi du code (apres un delai).
function LoginCodeStep({ challenge, email, onSuccess, onBack }) {
  const t = useTranslations("account.login");
  const errorText = useErrorMessage();
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(challenge.resendIn);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const codeError = submitted && !CODE_PATTERN.test(code) ? t("codeInvalid") : undefined;

  const verify = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    setInfo("");
    if (!CODE_PATTERN.test(code)) return;
    setLoading(true);
    try {
      const result = await authApi.verifyLogin({ challenge: challenge.token, code, trustDevice });
      onSuccess(result.user);
    } catch (err) {
      setLoading(false);
      // Code expire, deja utilise ou trop d'essais : il faut recommencer la connexion.
      if (err?.response?.data?.code === "LOGIN_CODE_EXPIRED") return onBack(errorText(err));
      setError(errorText(err));
      setCode("");
      setSubmitted(false);
    }
  };

  const resend = async () => {
    setError("");
    setInfo("");
    setResending(true);
    try {
      const result = await authApi.resendLoginCode(challenge.token);
      setCooldown(result.resendIn || 60);
      setCode("");
      setSubmitted(false);
      setInfo(t("codeResent"));
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === "LOGIN_CODE_EXPIRED") return onBack(errorText(err));
      if (data?.details?.retryAfter) setCooldown(Number(data.details.retryAfter));
      setError(errorText(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCard
      title={t("codeTitle")}
      description={t.rich("codeDescription", { email, strong: (chunks) => <strong>{chunks}</strong> })}
    >
      <form className="stack" onSubmit={verify} noValidate>
        <div aria-live="polite" className="stack">
          {error && <Alert tone="danger">{error}</Alert>}
          {info && <Alert tone="success">{info}</Alert>}
        </div>
        <Input
          label={t("codeLabel")}
          hint={t("codeHint")}
          className="acc-code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          enterKeyHint="done"
          autoFocus
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          error={codeError}
        />
        <label className="acc-check">
          <input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} />
          <span>
            {t("trustDevice")}
            <small className="acc-check__hint">{t("trustDeviceHint")}</small>
          </span>
        </label>
        <Button type="submit" size="lg" block icon={ShieldCheck} loading={loading}>
          {t("codeSubmit")}
        </Button>
        <div className="acc-code-actions">
          <button type="button" className="acc-link-button" onClick={() => onBack()}>
            <ArrowLeft size={16} aria-hidden="true" /> {t("codeBack")}
          </button>
          <button type="button" className="acc-link-button" onClick={resend} disabled={cooldown > 0 || resending}>
            {cooldown > 0 ? t("codeResendIn", { seconds: cooldown }) : t("codeResend")}
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
