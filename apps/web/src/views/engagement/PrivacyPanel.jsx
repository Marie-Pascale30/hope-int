"use client";

// Espace membre : droits RGPD en libre-service (export JSON, effacement avec confirmation).
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Card, Modal } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useLocalePath } from "../../i18n/navigation";
import { useRouter } from "next/navigation";
import { useErrorMessage } from "../../i18n/errors";
import { useAlerts } from "../../utils/alerts";
import { downloadBlob, memberEngagementApi } from "../../services/engagement";
import { setSessionHint } from "../../services/api";
import { PasswordInput } from "../account/components/PasswordFields";

// Duree affichee par defaut : la valeur appliquee est configuree cote API (ACCOUNTING_RETENTION_YEARS).
const DEFAULT_RETENTION_YEARS = 10;

export default function PrivacyPanel() {
  const t = useTranslations("engagement.account");
  const errorText = useErrorMessage();
  const { showError, showSuccess } = useAlerts();
  const { user, refresh } = useAuth();
  const router = useRouter();
  const lp = useLocalePath();
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Un compte de l'equipe doit d'abord perdre ses roles (verifie aussi par l'API).
  const staff = (user?.permissions || []).length > 0;

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await memberEngagementApi.exportData();
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `mes-donnees-hope-${date}.json`);
    } catch (err) {
      showError(t("exportError"), errorText(err));
    } finally {
      setExporting(false);
    }
  };

  const erase = async (event) => {
    event.preventDefault();
    if (!confirmed || !password) return;
    setBusy(true);
    setError("");
    try {
      await memberEngagementApi.erase(password);
      setSessionHint(false);
      setOpen(false);
      await showSuccess(t("eraseDone"));
      await refresh();
      router.push(lp("/"));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="acc-section-title">{t("privacyTitle")}</h2>
      <p className="muted">{t("privacyText")}</p>
      <div className="form-actions">
        <Button variant="secondary" icon={Download} loading={exporting} onClick={exportData}>{t("export")}</Button>
        <Button variant="danger" icon={Trash2} disabled={staff} onClick={() => setOpen(true)}>{t("eraseButton")}</Button>
      </div>
      {staff && <p className="muted acc-small">{t("staffNote")}</p>}
      <Modal
        open={open}
        title={t("eraseTitle")}
        onClose={() => !busy && setOpen(false)}
        footer={(
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{t("eraseCancel")}</Button>
            <Button type="submit" form="eng-erase-form" variant="danger" icon={Trash2} loading={busy} disabled={!confirmed || !password}>
              {t("eraseSubmit")}
            </Button>
          </>
        )}
      >
        <form id="eng-erase-form" className="stack" onSubmit={erase} noValidate>
          <p>{t("eraseIntro")}</p>
          <ul>
            <li>{t("eraseKept", { years: DEFAULT_RETENTION_YEARS })}</li>
            <li>{t("eraseMonthly")}</li>
          </ul>
          <Alert tone="warning">{t("eraseIrreversible")}</Alert>
          {error && <Alert tone="danger">{error}</Alert>}
          <PasswordInput label={t("erasePassword")} required value={password} onChange={(event) => setPassword(event.target.value)} />
          <label className="eng-consents__item">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>{t("eraseConfirm")}</span>
          </label>
        </form>
      </Modal>
    </Card>
  );
}
