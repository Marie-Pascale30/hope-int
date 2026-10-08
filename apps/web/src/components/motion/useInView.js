"use client";

// Outils partages des animations du site public.
import { useEffect, useRef, useState } from "react";

// Pause entre deux lectures d'une animation qui se rejoue (compteur, surligneur).
export const REPLAY_DELAY = 5000;

// Preference systeme "reduire les animations" : les composants affichent alors directement l'etat final.
export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// true tant que l'element est a l'ecran : l'animation demarre a l'arrivee, s'arrete en sortie
// et repart du debut au retour.
export function useInView({ threshold = 0.35 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

// Animation CSS rejouee en boucle tant que l'element est a l'ecran : pose className (l'animation
// dure duration ms), attend REPLAY_DELAY, efface instantanement (classe is-resetting, sans
// transition) et recommence. Classes posees dans le DOM : pas de re-rendu a chaque boucle.
// La classe is-armed signale que JavaScript pilote l'element (sans JS : etat final affiche).
export function useClassReplay(ref, inView, { className = "is-visible", duration = 1000 } = {}) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (prefersReducedMotion()) {
      element.classList.add(className);
      return undefined;
    }
    element.classList.add("is-armed");
    if (!inView) {
      element.classList.remove(className);
      return undefined;
    }
    let timer;
    let frame;
    const play = () => {
      element.classList.add("is-resetting");
      element.classList.remove(className);
      frame = requestAnimationFrame(() => {
        element.classList.remove("is-resetting");
        frame = requestAnimationFrame(() => {
          element.classList.add(className);
          timer = setTimeout(play, duration + REPLAY_DELAY);
        });
      });
    };
    play();
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [ref, inView, className, duration]);
}
