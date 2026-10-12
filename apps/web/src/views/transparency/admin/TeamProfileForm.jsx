"use client";

// Formulaire du portrait public (consentement explicite, intitule, courte bio, photo).
// Utilise par l'administration (RH) et par la personne elle-meme : a integrer dans l'espace
// membre (onglet Profil) avec <MyPublicProfile />.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, ErrorState, Input, LoadingState, Switch, Textarea } from "@/src/components/ui";
import { useAsync } from "@/src/hooks/useAsync";
import { useErrorMessage } from "@/src/i18n/errors";
import { transparencyApi } from "@/src/services/transparency";
import { useAlerts } from "@/src/utils/alerts";
import { Thumb } from "@/src/views/admin/components/widgets";

// save(payload) : appel API ; renvoie le portrait enregistre.
export default function TeamProfileForm({ profile, save, onSaved, self = false }) {
  const t = useTranslations("transparency.profileForm");
  const getErrorMessage = useErrorMessage();
  const { toast, showError } = useAlerts();
  const [form, setForm] = useState({
    publicProfile: Boolean(profile.publicProfile),
    title: profile.title || "",
    bio: profile.bio || "",
    image: null,
    removePhoto: false,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await save({
        publicProfile: form.publicProfile,
        title: form.title,
        bio: form.bio,
        image: form.image || undefined,
        removePhoto: form.removePhoto && !form.image ? true : undefined,
      });
      toast(t("saved"));
      onSaved?.(saved);
    } catch (error) {
      showError(t("failed"), getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="field field--full">
        <Switch
          label={self ? t("consentSelf") : t("consentAdmin")}
          checked={form.publicProfile}
          onChange={(checked) => setForm((current) => ({ ...current, publicProfile: checked }))}
        />
        <span className="field__hint">{self ? t("consentSelfHint") : t("consentAdminHint")}</span>
      </div>
      <Input label={t("title")} value={form.title} onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))} maxLength={120} hint={t("titleHint")} full />
      <Textarea label={t("bio")} value={form.bio} onChange={(event) => setForm((c) => ({ ...c, bio: event.target.value }))} maxLength={600} rows={4} hint={t("bioHint")} full />
      <div className="field field--full tp-photo-field">
        {profile.photoUrl && !form.removePhoto && <Thumb src={profile.photoUrl} alt={t("currentPhoto")} className="tp-photo-thumb" />}
        <Input
          label={t("photo")}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hint={t("photoHint")}
          onChange={(event) => setForm((c) => ({ ...c, image: event.target.files?.[0] || null }))}
        />
        {profile.photoUrl && (
          <label className="choice">
            <input type="checkbox" checked={form.removePhoto} onChange={(event) => setForm((c) => ({ ...c, removePhoto: event.target.checked }))} />
            {t("removePhoto")}
          </label>
        )}
      </div>
      <div><Button type="submit" loading={saving}>{t("save")}</Button></div>
    </form>
  );
}

// Portrait de la personne connectee (a placer dans l'espace membre).
export function MyPublicProfile() {
  const t = useTranslations("transparency.profileForm");
  const getErrorMessage = useErrorMessage();
  const { data, loading, error, reload, setData } = useAsync(() => transparencyApi.myProfile(), []);
  if (error) return <ErrorState message={getErrorMessage(error)} onRetry={reload} />;
  if (loading || !data) return <LoadingState label={t("loading")} />;
  return (
    <section aria-labelledby="my-public-profile-title">
      <h2 id="my-public-profile-title">{t("selfTitle")}</h2>
      <Alert tone="info" title={t("selfInfoTitle")}>{t("selfInfoText")}</Alert>
      <TeamProfileForm key={data.consentAt || "none"} profile={data} self save={transparencyApi.updateMyProfile} onSaved={setData} />
    </section>
  );
}
