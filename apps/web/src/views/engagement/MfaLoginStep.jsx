"use client";

// Seconde etape de la connexion : code TOTP / code de secours ("verify"), ou enrolement
// obligatoire d'un compte de l'equipe ("setup"). onDone(user) une fois la session ouverte.
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Input } from "../../components/ui";
import { useErrorMessage } from "../../i18n/errors";
import { mfaApi } from "../../services/engagement";
import MfaSetupFlow, { BackupCodes } from "./MfaSetupFlow";

export default function MfaLoginStep({ step, onDone, onBack }) {
  const t = useTranslations("engagement.mfa");
  const errorText = useErrorMessage();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [enabled, setEnabled] = useState(null);

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await mfaApi.verify(code.trim());
      onDone(result.user);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  if (step === "setup") {
    if (enabled) return <BackupCodes codes={enabled.backupCodes} onDone={() => onDone(enabled.user)} />;
    return (
      <div className="stack">
        <Alert tone="info" title={t("loginSetupTitle")}>{t("loginSetupText")}</Alert>
        {started ? (
          <MfaSetupFlow onEnabled={setEnabled} onCancel={onBack} />
        ) : (
          <div className="form-actions">
            <Button icon={KeyRound} onClick={() => setStarted(true)}>{t("loginStart")}</Button>
            <Button variant="ghost" onClick={onBack}>{t("loginBack")}</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={verify} noValidate>
      <p className="muted">{t("loginVerifyText")}</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Input
        label={t("codeLabel")}
        hint={t("codeHint")}
        autoComplete="one-time-code"
        autoFocus
        required
        maxLength={20}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <Button type="submit" size="lg" block icon={KeyRound} loading={busy} disabled={code.trim().length < 6}>
        {t("loginSubmit")}
      </Button>
      <Button variant="ghost" block onClick={onBack}>{t("loginBack")}</Button>
    </form>
  );
}
