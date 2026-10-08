"use client";

// Chiffre qui defile de 0 a sa valeur quand il arrive a l'ecran (inspire de "Number Ticker", 21st.dev).
// Le rendu serveur affiche la valeur finale (sans JavaScript, moteurs de recherche) ; les lecteurs
// d'ecran lisent toujours la valeur finale, jamais les etapes intermediaires.
// Les etapes sont ecrites directement dans le DOM (une image par frame, sans re-rendu React).
import { useEffect, useRef } from "react";
import { useFormat } from "../../i18n/format";
import { euros } from "../../views/site/components/helpers";
import { REPLAY_DELAY, prefersReducedMotion, useInView } from "./useInView";

const DURATION = 1800;

// Depart rapide, arrivee en douceur
const easeOutExpo = (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x));

// f : formatteurs de la langue (objet stable, voir i18n/format)
const formatValue = (f, kind, n) => (kind === "eur" ? euros(f, n) : f.number(n));

// kind : "number" | "eur"
export default function NumberTicker({ value, kind = "number", className }) {
  const f = useFormat();
  const target = Number(value) || 0;
  const displayRef = useRef(null);
  const [ref, inView] = useInView({ threshold: 0.5 });

  // A l'ecran : defile de 0 a la valeur, marque une pause de REPLAY_DELAY, puis recommence.
  // Hors de l'ecran : revient a 0, pret a rejouer au retour.
  useEffect(() => {
    const display = displayRef.current;
    if (!display) return undefined;
    if (prefersReducedMotion()) {
      display.textContent = formatValue(f, kind, target);
      return undefined;
    }
    if (!inView) {
      display.textContent = formatValue(f, kind, 0);
      return undefined;
    }
    let frame;
    let timer;
    const play = () => {
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / DURATION, 1);
        display.textContent = formatValue(f, kind, Math.round(target * easeOutExpo(progress)));
        if (progress < 1) frame = requestAnimationFrame(tick);
        else timer = setTimeout(play, REPLAY_DELAY);
      };
      frame = requestAnimationFrame(tick);
    };
    play();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [inView, target, f, kind]);

  return (
    <span ref={ref} className={className}>
      <span className="visually-hidden">{formatValue(f, kind, target)}</span>
      <span ref={displayRef} className="number-ticker" aria-hidden="true">{formatValue(f, kind, target)}</span>
    </span>
  );
}
