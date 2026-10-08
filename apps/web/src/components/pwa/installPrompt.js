"use client";

// Etat d'installation de l'application (PWA), partage par les composants via useSyncExternalStore.
// - Android / Chrome / Edge : l'evenement beforeinstallprompt est retenu pour ouvrir la fenetre
//   d'installation native au clic.
// - iPhone / iPad (Safari) : pas d'evenement, l'installation passe par Partager > Sur l'ecran d'accueil.
import { useSyncExternalStore } from "react";

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIos() {
  const { userAgent, maxTouchPoints } = window.navigator;
  // iPadOS se presente comme un Mac : on le reconnait a l'ecran tactile.
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

// "native" : fenetre d'installation disponible ; "ios" : instructions manuelles ; null : rien a proposer.
function getMode() {
  if (isStandalone()) return null;
  if (deferredPrompt) return "native";
  return isIos() ? "ios" : null;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallMode() {
  return useSyncExternalStore(subscribe, getMode, () => null);
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null;
  event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === "accepted";
}
