"use client";

// Espace membre : preferences de communication du compte connecte.
import { useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Card, ErrorState, LoadingState } from "../../components/ui";
import { useErrorMessage } from "../../i18n/errors";
import { useAlerts } from "../../utils/alerts";
import { useAsync } from "../../hooks/useAsync";
import { memberEngagementApi } from "../../services/engagement";
import TopicSwitches from "./TopicSwitches";

export default function PreferencesPanel() {
  const t = useTranslations("engagement.account");
  const tp = useTranslations("engagement.preferences");
  const errorText = useErrorMessage();
  const { toast, showError } = useAlerts();
  const { data, error, reload, setData } = useAsync(() => memberEngagementApi.preferences(), []);
  // Modifications en cours (null : valeurs enregistrees).
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const saved = data?.topics || null;
  const topics = draft || saved;

  const save = async () => {
    setBusy(true);
    try {
      const result = await memberEngagementApi.updatePreferences(topics);
      setData(result);
      setDraft(null);
      toast(t("preferencesSaved"));
    } catch (err) {
      showError(tp("saveError"), errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="acc-section-title">{t("preferencesTitle")}</h2>
      <p className="muted">{t("preferencesText")}</p>
      {error ? (
        <ErrorState message={errorText(error)} onRetry={reload} />
      ) : !topics ? (
        <LoadingState label={tp("loading")} />
      ) : (
        <>
          <TopicSwitches value={topics} onChange={setDraft} disabled={busy} />
          <div className="form-actions">
            <Button icon={Save} loading={busy} disabled={JSON.stringify(topics) === JSON.stringify(saved)} onClick={save}>
              {tp("save")}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
