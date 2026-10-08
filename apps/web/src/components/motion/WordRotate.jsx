"use client";

// Mot qui change a intervalle regulier (inspire de "Word Rotate", 21st.dev).
// Decoratif : le parent fournit le texte complet aux lecteurs d'ecran (aria-hidden ici).
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./useInView";

export default function WordRotate({ words, interval = 2800, className = "" }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2 || prefersReducedMotion()) return undefined;
    const timer = setInterval(() => setIndex((value) => (value + 1) % words.length), interval);
    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <span className={`word-rotate ${className}`.trim()} aria-hidden="true">
      {/* key : chaque nouveau mot rejoue l'animation d'entree */}
      <span key={index} className="word-rotate__word">{words[index]}</span>
    </span>
  );
}
