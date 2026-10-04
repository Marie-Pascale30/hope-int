"use client";

import { useCallback, useSyncExternalStore } from "react";

// Moyen de paiement prefere pour la page de don :
// - le dernier choix explicite du donateur (memorise dans le navigateur) prime toujours ;
// - sinon, un contexte camerounais / Afrique centrale (fuseau horaire, langue) suggere Mobile Money.
// Lu uniquement cote navigateur (useSyncExternalStore) : pas d'ecart d'hydratation avec le rendu serveur.

const STORAGE_KEY = "hope_don_method";
const METHODS = ["card", "mobile_money"];

// Fuseaux UTC+1 d'Afrique centrale (zone CEMAC et voisins proches).
const CENTRAL_AFRICA_TIMEZONES = new Set([
  "Africa/Douala",
  "Africa/Libreville",
  "Africa/Malabo",
  "Africa/Bangui",
  "Africa/Brazzaville",
  "Africa/Ndjamena",
  "Africa/Kinshasa",
  "Africa/Lagos",
  "Africa/Luanda",
]);
// Pays de la zone CEMAC (francs CFA d'Afrique centrale) dans les langues du navigateur (ex. fr-CM).
const CENTRAL_AFRICA_REGIONS = ["CM", "GA", "GQ", "CF", "CG", "TD"];

function readStored() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return METHODS.includes(value) ? value : "";
  } catch {
    return "";
  }
}

function isCentralAfrica() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (CENTRAL_AFRICA_TIMEZONES.has(zone)) return true;
  } catch {
    // Intl indisponible : on s'appuie sur la langue.
  }
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language || ""];
  return languages.some((language) => CENTRAL_AFRICA_REGIONS.includes(String(language).split("-")[1]?.toUpperCase()));
}

// Valeur stable (chaine) : "card" | "mobile_money" (choix memorise), "region" (contexte africain) ou "".
function getSnapshot() {
  return readStored() || (isCentralAfrica() ? "region" : "");
}

const getServerSnapshot = () => "";

const listeners = new Set();
function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => event.key === STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePaymentPreference() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const remember = useCallback((method) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, method);
    } catch {
      // Stockage indisponible (navigation privee stricte) : le choix vaut pour la page en cours.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return {
    stored: METHODS.includes(snapshot) ? snapshot : "",
    centralAfrica: snapshot === "region",
    remember,
  };
}

// Moyen preselectionne : choix memorise, sinon Mobile Money en contexte africain s'il est disponible, sinon carte.
// Un moyen indisponible cede la place a l'autre s'il est ouvert ; le don mensuel passe toujours par carte.
export function pickPaymentMethod({ stored, centralAfrica, stripeReady, mobileReady, metaLoaded, frequency }) {
  if (frequency === "monthly") return "card";
  const wanted = stored || (centralAfrica && (mobileReady || !metaLoaded) ? "mobile_money" : "card");
  if (!metaLoaded) return wanted;
  if (wanted === "mobile_money" && !mobileReady && stripeReady) return "card";
  if (wanted === "card" && !stripeReady && mobileReady) return "mobile_money";
  return wanted;
}
