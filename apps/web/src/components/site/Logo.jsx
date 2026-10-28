import Image from "next/image";
import Link from "next/link";
import sun from "@/public/images/brand/soleil-hope-detoure.png";

// Embleme officiel : le soleil du logo HOPE International Project (version detouree,
// generee par scripts/generate-icons.js a partir de public/images/brand/soleil-hope.png).
export function LogoMark({ size = 36 }) {
  return <Image src={sun} alt="" aria-hidden="true" width={size} height={size} className="logo__mark" />;
}

// label : nom accessible du lien (traduit par l'appelant).
// "HOPE" en brun de marque, "International Project" en or fonce (tokens lisibles dans les deux themes).
export default function Logo({ href = "/", light = false, label = "HOPE International Project — accueil" }) {
  return (
    <Link href={href} className={`logo${light ? " logo--light" : ""}`} aria-label={label}>
      <LogoMark />
      <span className="logo__text">
        HOPE
        <small>International Project</small>
      </span>
    </Link>
  );
}
