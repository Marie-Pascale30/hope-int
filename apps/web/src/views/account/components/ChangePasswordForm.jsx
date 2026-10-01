"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Alert, Button } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { authApi } from "../../../services";
import { getErrorMessage } from "../../../services/api";
import { toast } from "../../../utils/alerts";
import { PasswordInput, PasswordStrength } from "./PasswordFields";
import { isStrongPassword } from "./authHelpers";

const EMPTY = { currentPassword: "", newPassword: "", confirm: "" };

// Formulaire de changement de mot de passe (page dediee et onglet Securite de l'espace).
export default function ChangePasswordForm({ onDone, submitLabel = "Mettre à jour le mot de passe" }) {
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
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.");
      return;
    }
    if (form.newPassword !== form.confirm) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    try {
      const result = await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      updateSession(result.token, result.user);
      setForm(EMPTY);
      setSubmitted(false);
      toast("Mot de passe modifié");
      onDone?.(result.user);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <PasswordInput
        label="Mot de passe actuel"
        required
        value={form.currentPassword}
        onChange={set("currentPassword")}
        error={submitted && !form.currentPassword ? "Indiquez votre mot de passe actuel" : undefined}
      />
      <PasswordInput
        label="Nouveau mot de passe"
        required
        autoComplete="new-password"
        value={form.newPassword}
        onChange={set("newPassword")}
      />
      <PasswordStrength password={form.newPassword} />
      <PasswordInput
        label="Confirmez le nouveau mot de passe"
        required
        autoComplete="new-password"
        value={form.confirm}
        onChange={set("confirm")}
        error={mismatch ? "Les mots de passe ne correspondent pas" : undefined}
      />
      <div className="form-actions acc-form-actions">
        <Button type="submit" icon={KeyRound} loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}
