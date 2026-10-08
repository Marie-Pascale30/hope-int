"use client";

// Enregistre le service worker (public/sw.js) en production uniquement : en developpement,
// un cache de pages genererait des versions perimees, on desinscrit donc tout worker existant.
import { useEffect } from "react";
import "./installPrompt";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((r) => r.unregister()));
      return;
    }
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
