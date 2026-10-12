"use client";

// Enrolement de la double authentification : secret et lien otpauth, premier code, puis codes de
// secours affiches une seule fois. Utilise depuis l'espace membre (session ouverte) et a la
// connexion d'un compte de l'equipe oblige de s'equiper (jeton de verification).
// QR code : aucune bibliotheque n'est installee, la cle est saisie a la main (voir qrNote).
import { useEffect, useRef, useState } from "react";
import { Copy, Download, KeyRound, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Input, LoadingState } from "../../components/ui";
import { useErrorMessage } from "../../i18n/errors";
import { mfaApi } from "../../services/engagement";

function CopyButton({ value }) {
  const t = useTranslations("engagement.mfa");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button size="sm" variant="secondary" icon={Copy} onClick={copy} aria-live="polite">
      {copied ? t("copied") : t("copy")}
    </Button>
  );
}

export function BackupCodes({ codes, onDone }) {
  const t = useTranslations("engagement.mfa");
  const download = () => {
    const blob = new Blob([`${codes.join("\n")}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hope-codes-de-secours.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="stack">
      <Alert tone="warning" title={t("backupTitle")}>{t("backupText")}</Alert>
      <ul className="eng-codes" aria-label={t("backupTitle")}>
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
      <div className="form-actions">
        <Button variant="secondary" icon={Download} onClick={download}>{t("downloadCodes")}</Button>
        <CopyButton value={codes.join("\n")} />
        <Button icon={ShieldCheck} onClick={onDone}>{t("backupDone")}</Button>
      </div>
    </div>
  );
}

// onEnabled({ user, backupCodes }) : appele apres l'activation (nouvelle session ouverte par l'API).
export default function MfaSetupFlow({ onEnabled, onCancel }) {
  const t = useTranslations("engagement.mfa");
  const errorText = useErrorMessage();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mfaApi.setup().then(setSetup).catch((err) => setError(errorText(err)));
  }, [errorText]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onEnabled(await mfaApi.enable(code.trim()));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  if (!setup && !error) return <LoadingState label={t("setupTitle")} />;

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      {setup && (
        <>
          <ol className="eng-steps">
            <li>{t("setupStep1")}</li>
            <li>{t("setupStep2")}</li>
            <li>{t("setupStep3")}</li>
          </ol>
          <div>
            <strong>{t("secretLabel")}</strong>
            <div className="eng-secret">
              <code>{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
              <CopyButton value={setup.secret} />
            </div>
          </div>
          <div>
            <strong>{t("urlLabel")}</strong>
            <div className="eng-secret">
              <a href={setup.otpauthUrl} className="acc-small">{t("urlLabel")}</a>
              <CopyButton value={setup.otpauthUrl} />
            </div>
          </div>
          <p className="muted acc-small">{t("qrNote")}</p>
          <Input
            label={t("codeLabel")}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          <div className="form-actions">
            <Button type="submit" icon={KeyRound} loading={busy} disabled={code.length !== 6}>{t("confirm")}</Button>
            {onCancel && <Button variant="ghost" onClick={onCancel}>{t("cancel")}</Button>}
          </div>
        </>
      )}
    </form>
  );
}
