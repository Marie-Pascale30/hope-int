"use client";

// Conteneur qui rejoue une animation CSS a chaque passage a l'ecran, puis toutes les REPLAY_DELAY
// (ex. barre de collecte qui se remplit : className="progress-reveal", voir motion.css).
import { useClassReplay, useInView } from "./useInView";

export default function Reveal({ className = "", duration = 1400, children }) {
  const [ref, inView] = useInView({ threshold: 0.6 });
  useClassReplay(ref, inView, { duration });
  return <div ref={ref} className={className}>{children}</div>;
}
