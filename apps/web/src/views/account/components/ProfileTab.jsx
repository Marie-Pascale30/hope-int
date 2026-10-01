"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Badge, Button, Card, Input } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { authApi } from "../../../services";
import { getErrorMessage } from "../../../services/api";
import { showError, toast } from "../../../utils/alerts";
import { roleLabel } from "../../../utils/labels";

export default function ProfileTab() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: user.name || "", phone: user.phone || "" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameError = submitted && form.name.trim().length < 2 ? "Indiquez votre nom (2 caractères minimum)" : undefined;
  const dirty = form.name.trim() !== (user.name || "") || form.phone.trim() !== (user.phone || "");

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (form.name.trim().length < 2) return;
    setSaving(true);
    try {
      await authApi.updateMe({ name: form.name.trim(), phone: form.phone.trim() });
      await refresh();
      toast("Profil mis à jour");
    } catch (err) {
      showError("Enregistrement impossible", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acc-columns acc-tab">
      <Card>
        <h2 className="acc-section-title">Mes informations</h2>
        <form className="stack" onSubmit={submit} noValidate>
          <Input
            label="Nom complet"
            autoComplete="name"
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            error={nameError}
          />
          <Input
            label="Téléphone"
            type="tel"
            autoComplete="tel"
            placeholder="Ex. : +237 6 77 12 34 56"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            hint="Utile pour les dons Mobile Money et les événements."
          />
          <div className="form-actions acc-form-actions">
            <Button type="submit" icon={Save} loading={saving} disabled={!dirty}>Enregistrer</Button>
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="acc-section-title">Compte</h2>
        <dl className="dl">
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Région</dt>
          <dd>{user.region || "Non renseignée"}</dd>
          <dt>Rôles</dt>
          <dd className="chip-list">
            {(user.roles || [user.role]).map((role) => (
              <Badge key={role} tone="brand">{roleLabel(role)}</Badge>
            ))}
          </dd>
        </dl>
        <p className="muted acc-small">
          Pour modifier votre email, votre région ou vos rôles, écrivez-nous depuis la page Contact : ces informations sont
          gérées par notre équipe.
        </p>
      </Card>
    </div>
  );
}
