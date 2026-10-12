"use client";

// Page publique /preferences?token=...&sujet=... : gestion des emails recus, sans connexion,
// depuis le lien signe present dans chaque email non transactionnel.
import "./engagement.css";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellOff, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { CONSENT_TOPICS } from "@hope/shared/engagement";
import { Alert, Button, Card, LoadingState } from "../../components/ui";
import { useLocalePath } from "../../i18n/navigation";
import { useErrorMessage } from "../../i18n/errors";
import { preferencesApi } from "../../services/engagement";
import TopicSwitches from "./TopicSwitches";

export default function PreferencesView() {
  const t = useTranslations("engagement.preferences");
  const tt = useTranslations("engagement.topics");
  const errorText = useErrorMessage();
  const lp = useLocalePath();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const focus = CONSENT_TOPICS.includes(params.get("sujet")) ? params.get("sujet") : null;

  const [state, setState] = useState(token ? "loading" : "invalid");
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState(null);
  const [saved, setSaved] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    preferencesApi.getByToken(token)
      .then((result) => {
        if (!active) return;
        setEmail(result.email);
        setTopics(result.topics);
        setSaved(result.topics);
        setState("ready");
      })
      .catch(() => active && setState("invalid"));
    return () => {
      active = false;
    };
  }, [token]);

  const apply = (result, message) => {
    setTopics(result.topics);
    setSaved(result.topics);
    setNotice(message);
    setError("");
  };

  const run = async (action, message) => {
    setBusy(true);
    try {
      apply(await action(), message);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return <LoadingState label={t("loading")} />;

  if (state === "invalid") {
    return (
      <section className="eng-page">
        <Alert tone="warning" title={t("invalidTitle")}>{t("invalidText")}</Alert>
        <p><Button href={lp("/espace?onglet=profil")} variant="secondary">{t("accountLink")}</Button></p>
      </section>
    );
  }

  const dirty = JSON.stringify(topics) !== JSON.stringify(saved);
  const focusLabel = focus ? tt(`${focus}.label`) : "";

  return (
    <section className="eng-page stack">
      <div>
        <h1>{t("title")}</h1>
        <p className="muted">{t("description")}</p>
        <p className="muted">{t("forEmail", { email })}</p>
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {focus && saved?.[focus] && (
        <Card>
          <h2 className="acc-section-title">{t("quickTitle")}</h2>
          <p>{t("quickText", { topic: focusLabel })}</p>
          <Button
            variant="secondary"
            icon={BellOff}
            loading={busy}
            onClick={() => run(() => preferencesApi.unsubscribe(token, focus), t("quickDone", { topic: focusLabel }))}
          >
            {t("quickButton", { topic: focusLabel })}
          </Button>
        </Card>
      )}
      <Card>
        <TopicSwitches value={topics} onChange={setTopics} focus={focus} disabled={busy} />
        <div className="form-actions">
          <Button icon={Save} loading={busy} disabled={!dirty} onClick={() => run(() => preferencesApi.updateByToken(token, topics), t("saved"))}>
            {t("save")}
          </Button>
          <Button variant="ghost" icon={BellOff} disabled={busy} onClick={() => run(() => preferencesApi.unsubscribe(token, "all"), t("unsubscribedAll"))}>
            {t("unsubscribeAll")}
          </Button>
        </div>
      </Card>
    </section>
  );
}
