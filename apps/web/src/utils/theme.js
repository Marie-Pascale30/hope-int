// Theme clair / sombre / systeme.
// La preference est stockee dans localStorage ("light" | "dark" ; absente = systeme)
// et appliquee sur <html data-theme="...">. Le script THEME_INIT_SCRIPT (layout racine)
// (src/utils/themeScript.js) l'applique avant le premier rendu pour eviter le flash.
import { useEffect, useState, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./themeScript";

export { THEME_STORAGE_KEY };
export const THEME_CHANGE_EVENT = "hope:themechange";
export const THEME_PREFERENCES = ["light", "dark", "system"];

export function readThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyThemePreference(preference) {
  const root = document.documentElement;
  if (preference === "light" || preference === "dark") root.setAttribute("data-theme", preference);
  else root.removeAttribute("data-theme");
  try {
    if (preference === "light" || preference === "dark") localStorage.setItem(THEME_STORAGE_KEY, preference);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // stockage indisponible : le choix vaut pour la page courante
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { preference } }));
}

// Theme effectivement affiche ("light" | "dark"), en tenant compte de la preference systeme.
function getResolvedTheme() {
  const forced = document.documentElement.getAttribute("data-theme");
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(callback) {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    media?.removeEventListener?.("change", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

// Theme affiche, mis a jour a chaque changement (preference systeme, selecteur, autre onglet).
export function useResolvedTheme() {
  return useSyncExternalStore(subscribe, getResolvedTheme, () => "light");
}

// Preference choisie par le visiteur (pour le selecteur).
export function useThemePreference() {
  const [preference, setPreference] = useState("system");

  useEffect(() => {
    const sync = () => setPreference(readThemePreference());
    // Choix fait dans un autre onglet : on l'applique aussi ici.
    const onStorage = (event) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = readThemePreference();
      if (next === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", next);
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { preference: next } }));
    };
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [preference, applyThemePreference];
}

// Lit la valeur courante d'un token CSS (ex. "--chart-1") sur :root.
export function readCssToken(name, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
