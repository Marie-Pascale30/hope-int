"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, Input } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { authApi } from "../../../services";
import { useAlerts } from "../../../utils/alerts";
import { useLabels } from "../../../utils/labels";
import { useErrorMessage } from "../../../i18n/errors";

export default function ProfileTab() {
  const t = useTranslations("account.profile");
  const tf = useTranslations("account.fields");
  const labels = useLabels();
  const { showError, toast } = useAlerts();
  const errorText = useErrorMessage();
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: user.name || "", phone: user.phone || "" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameError = submitted && form.name.trim().length < 2 ? tf("nameMin", { min: 2 }) : undefined;
  const dirty = form.name.trim() !== (user.name || "") || form.phone.trim() !== (user.phone || "");

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (form.name.trim().length < 2) return;
    setSaving(true);
    try {
      await authApi.updateMe({ name: form.name.trim(), phone: form.phone.trim() });
      await refresh();
      toast(t("saved"));
    } catch (err) {
      showError(t("saveError"), errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acc-columns acc-tab">
      <Card>
        <h2 className="acc-section-title">{t("title")}</h2>
        <form className="stack" onSubmit={submit} noValidate>
          <Input
            label={tf("fullName")}
            autoComplete="name"
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            error={nameError}
          />
          <Input
            label={t("phone")}
            type="tel"
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            hint={t("phoneHint")}
          />
          <div className="form-actions acc-form-actions">
            <Button type="submit" icon={Save} loading={saving} disabled={!dirty}>{t("save")}</Button>
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="acc-section-title">{t("accountTitle")}</h2>
        <dl className="dl">
          <dt>{t("email")}</dt>
          <dd>{user.email}</dd>
          <dt>{t("region")}</dt>
          <dd>{user.region || t("regionEmpty")}</dd>
          <dt>{t("roles")}</dt>
          <dd className="chip-list">
            {(user.roles || [user.role]).map((role) => (
              <Badge key={role} tone="brand">{labels.role(role)}</Badge>
            ))}
          </dd>
        </dl>
        <p className="muted acc-small">{t("managedNote")}</p>
      </Card>
    </div>
  );
}
