"use client";

// Mode "eco donnees" : images en basse definition, ni graphiques ni animations.
// Preference en cookie (hope_eco=1|0, un an) ; l'attribut data-eco de <html> est pose avant
// l'affichage par le script de app/_lib/pwa.js (cookie, ou Save-Data du navigateur sans choix
// enregistre). Ce module lit et modifie cet attribut.
import { useSyncExternalStore } from "react";
import { Leaf } from "lucide-react";
// Styles de la bascule (.eco-toggle), affichee aussi dans le pied de page de toutes les pages.
import "@/src/styles/transparency.css";
import { useTranslations } from "next-intl";

export const ECO_COOKIE = "hope_eco";
const EVENT = "hope:eco-change";

function subscribe(callback) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

export const readDataSaver = () => typeof document !== "undefined" && document.documentElement.dataset.eco === "1";

// Rendu serveur (et hydratation) : mode normal ; bascule juste apres si la preference est active.
export function useDataSaver() {
  return useSyncExternalStore(subscribe, readDataSaver, () => false);
}

export function setDataSaver(enabled) {
  document.cookie = `${ECO_COOKIE}=${enabled ? 1 : 0}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  if (enabled) document.documentElement.dataset.eco = "1";
  else delete document.documentElement.dataset.eco;
  window.dispatchEvent(new Event(EVENT));
}

// Bascule accessible (bouton a etat : aria-pressed).
export function DataSaverToggle({ className }) {
  const t = useTranslations("transparency.eco");
  const enabled = useDataSaver();
  return (
    <button
      type="button"
      className={`eco-toggle${enabled ? " is-on" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={enabled}
      onClick={() => setDataSaver(!enabled)}
      title={t("hint")}
    >
      <Leaf size={16} aria-hidden="true" />
      <span>{t("label")}</span>
      <span className="eco-toggle__state">{enabled ? t("on") : t("off")}</span>
    </button>
  );
}
