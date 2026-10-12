"use client";

// Barre d'action collante en bas d'ecran (fiches projet et evenement, < 960 px), sur le modele de
// la barre de don (.don-sticky). Elle se masque des que le bloc d'action de la page (targetId) est
// visible ou deja depasse, et pendant la saisie (clavier virtuel). Masquee, elle sort de l'arbre
// d'accessibilite et de l'ordre de tabulation (visibility: hidden + inert).
import { useEffect, useState } from "react";

export default function StickyAction({ targetId, label, children }) {
  const [targetInView, setTargetInView] = useState(true);

  useEffect(() => {
    const node = document.getElementById(targetId);
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setTargetInView(entry.isIntersecting || entry.boundingClientRect.top < 0);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [targetId]);

  const hidden = targetInView;
  return (
    <>
      <div className="pub-sticky-spacer" aria-hidden="true" />
      <div
        className={`pub-sticky${hidden ? " is-hidden" : ""}`}
        role="region"
        aria-label={label}
        inert={hidden ? true : undefined}
      >
        {children}
      </div>
    </>
  );
}
