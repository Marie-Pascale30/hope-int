"use client";

// Bouton unique clair <-> sombre (en-tete du site) : bascule le theme affiche
// et memorise le choix, comme le selecteur complet de l'espace admin.
// Les deux icones sont rendues et le CSS affiche la bonne des le premier rendu
// (le theme n'est pas connu cote serveur) : pas de clignotement a l'hydratation.
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { applyThemePreference, useResolvedTheme } from "../utils/theme";

export default function ThemeToggle({ className = "" }) {
  const t = useTranslations("theme");
  const isDark = useResolvedTheme() === "dark";
  const label = isDark ? t("switchToLight") : t("switchToDark");

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={() => applyThemePreference(isDark ? "light" : "dark")}
    >
      <Moon size={18} className="theme-toggle__moon" aria-hidden="true" />
      <Sun size={18} className="theme-toggle__sun" aria-hidden="true" />
    </button>
  );
}
