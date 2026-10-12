"use client";

// Mot surligne d'un coup de marqueur quand il arrive a l'ecran (inspire de "Text Highlight", 21st.dev).
// Le trait se redessine toutes les REPLAY_DELAY tant que le mot reste a l'ecran, et au retour.
// Usage avec next-intl : t.rich("cle", { hl }) (voir hl.jsx).
import { useClassReplay, useInView } from "./useInView";

// Duree du trace (transition CSS de .text-highlight : 0.9s + 0.15s de delai)
const DRAW_DURATION = 1050;

export default function Highlight({ children }) {
  const [ref, inView] = useInView({ threshold: 0.8 });
  useClassReplay(ref, inView, { duration: DRAW_DURATION });
  return <span ref={ref} className="text-highlight">{children}</span>;
}
