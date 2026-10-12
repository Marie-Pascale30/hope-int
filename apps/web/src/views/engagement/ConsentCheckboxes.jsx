"use client";

// Cases de consentement reutilisables (inscription, don, espace membre).
// value : { newsletter: false, project_news: true, ... } ; onChange(nextValue).
// A envoyer tel quel a l'API dans le champ "consents" :
//   - inscription : POST /auth/register { ..., consents } ;
//   - don : l'API des dons appelle preferences.recordConsents({ email, userId, consents, source: "donation" }).
// La newsletter n'est jamais precochee (accord explicite, confirme par email).
import { useId } from "react";
import { useTranslations } from "next-intl";

export const DEFAULT_CONSENT_TOPICS = ["newsletter", "project_news"];

// Valeurs initiales : newsletter decochee (opt-in) ; les autres sujets, refusables, sont precoches.
export function initialConsents(topics = DEFAULT_CONSENT_TOPICS) {
  return Object.fromEntries(topics.map((topic) => [topic, topic !== "newsletter"]));
}

export default function ConsentCheckboxes({ value, onChange, topics = DEFAULT_CONSENT_TOPICS, disabled = false }) {
  const t = useTranslations("engagement.consent");
  const id = useId();
  const current = value || initialConsents(topics);
  return (
    <fieldset className="eng-consents" aria-describedby={`${id}-note`}>
      <legend className="eng-consents__legend">{t("legend")}</legend>
      {topics.map((topic) => (
        <label key={topic} className="eng-consents__item">
          <input
            type="checkbox"
            checked={Boolean(current[topic])}
            disabled={disabled}
            onChange={(event) => onChange({ ...current, [topic]: event.target.checked })}
          />
          <span>{t(topic)}</span>
        </label>
      ))}
      <p id={`${id}-note`} className="eng-consents__note">{t("note")}</p>
    </fieldset>
  );
}
