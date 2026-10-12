"use client";

// Compteur anime a l'entree dans l'ecran (accueil). Le rendu serveur affiche la valeur finale
// (referencement, JavaScript desactive) ; l'animation ne joue que pour un compteur encore hors de
// l'ecran au chargement, et jamais si prefers-reduced-motion ou le mode eco donnees est actif.
// Les lecteurs d'ecran lisent toujours la valeur finale.
import { useEffect, useRef, useState } from "react";
import { useFormat } from "@/src/i18n/format";
import { readDataSaver } from "@/src/components/eco/DataSaver";

const DURATION_MS = 1200;

// Courbe de deceleration (ease-out cubique).
export const easeOut = (t) => 1 - (1 - t) ** 3;

// Valeur affichee a l'instant t (0 a 1) d'une animation vers target.
export function frameValue(target, t) {
  return Math.round(target * easeOut(Math.min(1, Math.max(0, t))));
}

export function canAnimate() {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return !readDataSaver();
}

// format : "number" ou "eur" (montant arrondi a l'euro).
export default function AnimatedCounter({ value, format = "number", className }) {
  const f = useFormat();
  const target = Math.round(Number(value) || 0);
  const ref = useRef(null);
  const [shown, setShown] = useState(target);
  const display = (amount) => (format === "eur" ? f.money(amount, "eur") : f.number(amount));

  useEffect(() => {
    const node = ref.current;
    if (!node || !target || !canAnimate()) return undefined;
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return undefined;

    let frame = 0;
    setShown(0);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const progress = (now - start) / DURATION_MS;
        setShown(frameValue(target, progress));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      setShown(target);
    };
  }, [target]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{display(shown)}</span>
      <span className="visually-hidden">{display(target)}</span>
    </span>
  );
}
