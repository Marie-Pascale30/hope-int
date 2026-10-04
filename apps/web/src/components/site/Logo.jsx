import Link from "next/link";

// Embleme : une pousse dans un cercle (croissance, espoir), declinee en vert et ocre.
export function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#1f5f4a" />
      <path d="M20 31V19" stroke="#faf7f2" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 21c0-5.5 3.8-9.2 9.5-9.5-.3 5.7-4 9.5-9.5 9.5Z" fill="#d2772a" />
      <path d="M20 24c0-4.6-3.2-7.7-7.9-7.9.2 4.7 3.3 7.9 7.9 7.9Z" fill="#faf7f2" />
    </svg>
  );
}

// label : nom accessible du lien (traduit par l'appelant).
export default function Logo({ href = "/", light = false, label = "HOPE International — accueil" }) {
  return (
    <Link href={href} className={`logo${light ? " logo--light" : ""}`} aria-label={label}>
      <LogoMark />
      <span className="logo__text">
        HOPE
        <small>International</small>
      </span>
    </Link>
  );
}
