"use client";

// Badges de benevolat (calcules par l'API a partir des seuils de @hope/shared/volunteering).
import { Award, CalendarCheck, Clock, Medal, Sparkles, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/src/i18n/format";

const ICONS = {
  first_step: Sparkles,
  hours_10: Clock,
  hours_50: Medal,
  hours_100: Trophy,
  events_5: CalendarCheck,
  one_year: Award,
};

export default function BadgeList({ badges = [] }) {
  const t = useTranslations("volunteering.badges");
  const f = useFormat();
  if (!badges.length) return null;
  return (
    <ul className="vol-badges" aria-label={t("label")}>
      {badges.map((badge) => {
        const Icon = ICONS[badge.key] || Award;
        return (
          <li key={badge.key} className={`vol-badge${badge.earned ? " vol-badge--earned" : ""}`}>
            <span className="vol-badge__icon" aria-hidden="true"><Icon size={20} /></span>
            <span className="vol-badge__text">
              <strong>{t(`names.${badge.key}`)}</strong>
              <span>
                {badge.earned
                  ? t("earned")
                  : t(`progress.${badge.metric}`, { value: f.number(badge.value), threshold: f.number(badge.threshold) })}
              </span>
            </span>
            {!badge.earned && (
              <span className="vol-badge__bar" aria-hidden="true">
                <span style={{ width: `${badge.progress}%` }} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
