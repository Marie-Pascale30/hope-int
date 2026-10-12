"use client";

// Espace membre : double authentification (activation, codes de secours, desactivation).
import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, Card, Input, LoadingState, Modal } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useErrorMessage } from "../../i18n/errors";
import { useAlerts } from "../../utils/alerts";
import { mfaApi } from "../../services/engagement";
import { PasswordInput } from "../account/components/PasswordFields";
import MfaSetupFlow, { BackupCodes } from "./MfaSetupFlow";

export default function MfaPanel() {
  const t = useTranslations("engagement.mfa");
  const errorText = useErrorMessage();
  const { toast } = useAlerts();
  const { updateSession } = useAuth();
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState(null); // setup | codes | disable | regenerate
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({ password: "", code: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    mfaApi.status().then(setStatus).catch((err) => setError(errorText(err)));
  }, [errorText]);

  useEffect(() => {
    load();
  }, [load]);

  const close = () => {
    setMode(null);
    setForm({ password: "", code: "" });
    setError("");
    setBusy(false);
  };

  const onEnabled = (result) => {
    // L'activation ferme les autres sessions et en ouvre une nouvelle ici.
    if (result.user) updateSession(result.user);
    setCodes(result.backupCodes);
    setMode("codes");
    toast(t("enabledToast"));
    load();
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "disable") {
        await mfaApi.disable({ password: form.password, code: form.code.trim() });
        toast(t("disabledToast"));
        close();
      } else {
        const result = await mfaApi.regenerateBackupCodes(form.code.trim());
        setCodes(result.backupCodes);
        setForm({ password: "", code: "" });
        setMode("codes");
        setBusy(false);
      }
      load();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  if (!status) {
    return <Card>{error ? <Alert tone="danger">{error}</Alert> : <LoadingState label={t("title")} />}</Card>;
  }

  return (
    <Card>
      <h2 className="acc-section-title">{t("title")}</h2>
      <p className="muted">{t("intro")}</p>
      <p className="chip-list">
        <Badge tone={status.enabled ? "success" : "warning"}>{status.enabled ? t("enabled") : t("disabled")}</Badge>
        {status.required && <Badge tone="info">{t("required")}</Badge>}
      </p>
      {status.enabled && <p className="muted acc-small">{t("backupRemaining", { count: status.backupCodesRemaining })}</p>}
      <div className="form-actions">
        {!status.enabled && <Button icon={ShieldCheck} onClick={() => setMode("setup")}>{t("enable")}</Button>}
        {status.enabled && <Button variant="secondary" icon={RefreshCw} onClick={() => setMode("regenerate")}>{t("regenerate")}</Button>}
        {status.enabled && !status.required && <Button variant="ghost" icon={ShieldOff} onClick={() => setMode("disable")}>{t("disable")}</Button>}
      </div>

      <Modal open={mode === "setup"} title={t("setupTitle")} onClose={close}>
        {mode === "setup" && <MfaSetupFlow onEnabled={onEnabled} onCancel={close} />}
      </Modal>
      <Modal open={mode === "codes"} title={t("backupTitle")} onClose={close}>
        <BackupCodes codes={codes} onDone={close} />
      </Modal>
      <Modal open={mode === "disable" || mode === "regenerate"} title={mode === "disable" ? t("disableTitle") : t("regenerate")} onClose={close}>
        <form className="stack" onSubmit={submit} noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          {mode === "disable" && (
            <PasswordInput
              label={t("passwordLabel")}
              required
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          )}
          <Input
            label={t("codeLabel")}
            hint={t("codeHint")}
            autoComplete="one-time-code"
            required
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
          />
          <div className="form-actions">
            <Button type="submit" variant={mode === "disable" ? "danger" : undefined} icon={KeyRound} loading={busy} disabled={form.code.trim().length < 6}>
              {t("confirm")}
            </Button>
            <Button variant="ghost" onClick={close}>{t("cancel")}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
