"use client";

// Liste des sujets de communication avec un interrupteur chacun.
import { CONSENT_TOPICS } from "@hope/shared/engagement";
import { useTranslations } from "next-intl";
import { Switch } from "../../components/ui";

export default function TopicSwitches({ value, onChange, focus, disabled }) {
  const t = useTranslations("engagement.topics");
  return (
    <ul className="eng-topics">
      {CONSENT_TOPICS.map((topic) => (
        <li key={topic} className={`eng-topic${focus === topic ? " eng-topic--focus" : ""}`}>
          <span className="eng-topic__text">
            <strong>{t(`${topic}.label`)}</strong>
            <span>{t(`${topic}.description`)}</span>
          </span>
          <Switch
            label={<span className="visually-hidden">{t(`${topic}.label`)}</span>}
            checked={Boolean(value?.[topic])}
            disabled={disabled}
            onChange={(checked) => onChange({ ...value, [topic]: checked })}
          />
        </li>
      ))}
    </ul>
  );
}
