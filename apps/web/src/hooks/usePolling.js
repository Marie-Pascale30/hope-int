"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Interrogation periodique : `callback` est appele toutes les `interval` ms, au plus `maxAttempts` fois.
// Suspendu quand la page est masquee (onglet en arriere-plan), arrete au demontage ou quand `active` passe a false.
// Renvoie { attempts, exhausted, polling, restart }.
export function usePolling(callback, { active = true, interval = 5000, maxAttempts = 24 } = {}) {
  const [attempts, setAttempts] = useState(0);
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const exhausted = attempts >= maxAttempts;

  useEffect(() => {
    if (!active || exhausted) return undefined;
    let timer = null;
    let cancelled = false;

    const tick = async () => {
      timer = null;
      try {
        await callbackRef.current(attempts + 1);
      } catch {
        // Une erreur ponctuelle n'interrompt pas l'interrogation.
      }
      if (!cancelled) setAttempts((count) => count + 1);
    };

    const schedule = () => {
      if (timer || document.visibilityState === "hidden") return;
      timer = window.setTimeout(tick, interval);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timer);
        timer = null;
      } else {
        schedule();
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, exhausted, attempts, interval]);

  const restart = useCallback(() => setAttempts(0), []);

  return { attempts, exhausted, polling: active && !exhausted, restart };
}
