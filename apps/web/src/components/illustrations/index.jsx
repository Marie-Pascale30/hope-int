// Illustrations de marque (SVG maison, legeres) : motifs inspires des tissus wax (cercles
// concentriques, losanges, feuilles), palette brand / accent. Couleurs portees par des classes
// CSS (variables du theme : clair et sombre), jamais codees en dur. Decoratives (aria-hidden).
import "@/src/styles/transparency.css";

// Bande de motifs wax : cercles concentriques alternes avec des losanges.
function WaxBand({ y, width = 240, step = 30 }) {
  const items = [];
  for (let x = step / 2, i = 0; x < width; x += step, i += 1) {
    items.push(
      i % 2 === 0 ? (
        <g key={x} transform={`translate(${x} ${y})`}>
          <circle r="10" className="ill-accent" />
          <circle r="6" className="ill-surface" />
          <circle r="2.5" className="ill-brand" />
        </g>
      ) : (
        <g key={x} transform={`translate(${x} ${y}) rotate(45)`}>
          <rect x="-7" y="-7" width="14" height="14" className="ill-brand" />
          <rect x="-3" y="-3" width="6" height="6" className="ill-accent-soft" />
        </g>
      )
    );
  }
  return <g className="ill-wax">{items}</g>;
}

function Frame({ children, className, viewBox = "0 0 240 180" }) {
  return (
    <svg className={`illustration${className ? ` ${className}` : ""}`} viewBox={viewBox} aria-hidden="true" focusable="false">
      <ellipse cx="120" cy="96" rx="104" ry="72" className="ill-soft" />
      <WaxBand y={166} />
      {children}
    </svg>
  );
}

// Pousse (embleme HOPE) : tige et deux feuilles.
function Sprout({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0V-34" className="ill-stroke-brand" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M0-28c0-11 7.6-18.4 19-19-.6 11.4-8 19-19 19Z" className="ill-accent" />
      <path d="M0-20c0-9.2-6.4-15.4-15.8-15.8.4 9.4 6.6 15.8 15.8 15.8Z" className="ill-brand" />
    </g>
  );
}

// Etat vide : panier tresse d'ou sort une jeune pousse.
export function EmptyIllustration({ className }) {
  return (
    <Frame className={className}>
      <Sprout x={120} y={104} scale={1.2} />
      <path d="M76 104h88l-10 46H86Z" className="ill-accent-soft" />
      <path d="M76 104h88" className="ill-stroke-brand" strokeWidth="4" strokeLinecap="round" />
      {[0, 1, 2].map((row) => (
        <path key={row} d={`M${82 + row * 2} ${118 + row * 11}h${76 - row * 4}`} className="ill-stroke-accent" strokeWidth="3" strokeDasharray="8 6" />
      ))}
    </Frame>
  );
}

// Page introuvable : panneau indicateur au bord d'un chemin.
export function NotFoundIllustration({ className }) {
  return (
    <Frame className={className}>
      <path d="M40 150c40-30 120-30 160 0" className="ill-stroke-accent" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="2 12" />
      <path d="M120 150V58" className="ill-stroke-brand" strokeWidth="6" strokeLinecap="round" />
      <path d="M120 62h52l12 12-12 12h-52Z" className="ill-brand" />
      <path d="M120 92H70l-12 12 12 12h50Z" className="ill-accent" />
      <text x="146" y="79" textAnchor="middle" className="ill-label ill-on-brand">404</text>
      <text x="92" y="109" textAnchor="middle" className="ill-label ill-on-accent">?</text>
      <Sprout x={180} y={150} scale={0.8} />
      <Sprout x={58} y={150} scale={0.6} />
    </Frame>
  );
}

// Hors ligne : antenne et ondes interrompues.
export function OfflineIllustration({ className }) {
  return (
    <Frame className={className}>
      <path d="M120 150V84" className="ill-stroke-brand" strokeWidth="6" strokeLinecap="round" />
      <path d="M104 150l16-40 16 40" className="ill-stroke-brand" strokeWidth="4" fill="none" strokeLinejoin="round" />
      <circle cx="120" cy="80" r="8" className="ill-accent" />
      <path d="M98 64a32 32 0 0 1 44 0" className="ill-stroke-accent" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M84 48a54 54 0 0 1 72 0" className="ill-stroke-muted" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="10 9" />
      <path d="M156 34l-72 84" className="ill-stroke-accent" strokeWidth="5" strokeLinecap="round" />
      <Sprout x={64} y={150} scale={0.7} />
    </Frame>
  );
}
