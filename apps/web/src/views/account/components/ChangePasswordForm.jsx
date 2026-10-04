"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { authApi } from "../../../services";
import { toast } from "../../../utils/alerts";
import { PasswordInput, PasswordStrength } from "./PasswordFields";
import { isStrongPassword } from "./authHelpers";
import { useErrorMessage } from "../../../i18n/errors";

const EMPTY = { currentPassword: "", newPassword: "", confirm: "" };

// Formulaire de changement de mot de passe (page dediee et onglet Securite de l'espace).
export default function ChangePasswordForm({ onDone, submitLabel }) {
  const t = useTranslations("account.password");
  const errorText = useErrorMessage();
  const { updateSession } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const mismatch = form.confirm && form.confirm !== form.newPassword;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (!isStrongPassword(form.newPassword)) {
      setError(t("errors.weakNew"));
      return;
    }
    if (form.newPassword !== form.confirm) {
      setError(t("errors.newMismatch"));
      return;
    }
    setSaving(true);
    try {
      const result = await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      updateSession(result.user);
      setForm(EMPTY);
      setSubmitted(false);
      toast(t("changed"));
      onDone?.(result.user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <PasswordInput
        label={t("current")}
        required
        value={form.currentPassword}
        onChange={set("currentPassword")}
        error={submitted && !form.currentPassword ? t("errors.currentRequired") : undefined}
      />
      <PasswordInput
        label={t("new")}
        required
        autoComplete="new-password"
        value={form.newPassword}
        onChange={set("newPassword")}
      />
      <PasswordStrength password={form.newPassword} />
      <PasswordInput
        label={t("confirmNew")}
        required
        autoComplete="new-password"
        value={form.confirm}
        onChange={set("confirm")}
        error={mismatch ? t("errors.mismatch") : undefined}
      />
      <div className="form-actions acc-form-actions">
        <Button type="submit" icon={KeyRound} loading={saving}>{submitLabel ?? t("update")}</Button>
      </div>
    </form>
  );
}
