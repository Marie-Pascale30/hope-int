"use client";

// Bloc replie derriere un bouton sur telephone (<= 768 px) et affiche normalement au-dela :
// filtres de l'admin, calendrier de l'agenda... Sur grand ecran, le conteneur est transparent
// (display: contents) et ses enfants gardent la mise en page de leur parent.
// count : nombre de filtres actifs, affiche dans le bouton.
import { useId, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cx } from "./utils";

export function MobileCollapse({ label, count = 0, className, children }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <div className={cx("mobile-collapse", open && "is-open", className)}>
      <button
        type="button"
        className="mobile-collapse__toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>{label}</span>
        {count > 0 && <span className="tab__count">{count}</span>}
        <ChevronDown size={16} className="mobile-collapse__chevron" aria-hidden="true" />
      </button>
      <div id={bodyId} className="mobile-collapse__body">{children}</div>
    </div>
  );
}
