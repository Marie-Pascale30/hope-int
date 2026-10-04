"use client";

// Selecteur de theme (Clair / Sombre / Systeme) : groupe de boutons radio natifs,
// utilisable au clavier (fleches) et lu correctement par les lecteurs d'ecran.
import { useId } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useThemePreference } from "../utils/theme";

const OPTIONS = [
  { value: "light", key: "light", icon: Sun },
  { value: "dark", key: "dark", icon: Moon },
  { value: "system", key: "system", icon: Monitor },
];

// onDark : variante pour fond sombre fixe (pied de page, barre laterale admin).
// compact : n'affiche que les icones (les libelles restent lus par les lecteurs d'ecran).
export default function ThemeSwitcher({ onDark, compact, className = "" }) {
  const t = useTranslations("theme");
  const [preference, setPreference] = useThemePreference();
  const name = useId();

  return (
    <fieldset className={`theme-switch${onDark ? " theme-switch--on-dark" : ""}${compact ? " theme-switch--compact" : ""} ${className}`.trim()}>
      <legend className={compact ? "visually-hidden" : "theme-switch__legend"}>{t("label")}</legend>
      <div className="theme-switch__options">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <label key={option.value} className="theme-switch__option" title={compact ? t(option.key) : undefined}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={preference === option.value}
                onChange={() => setPreference(option.value)}
              />
              <Icon size={16} aria-hidden="true" />
              <span className={compact ? "visually-hidden" : undefined}>{t(option.key)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
