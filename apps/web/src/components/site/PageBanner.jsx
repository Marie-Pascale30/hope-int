// Bandeau photo d'ouverture : passe sous l'en-tete transparent (qui y est en clair : data-header-overlay)
// et se fond dans le hero qui le suit. A placer juste avant le hero, en premier enfant de la page.
// Photos dans public/images/banners (remplacables sans toucher au code) ; position = object-position.
import Image from "next/image";

export const BANNERS = {
  home: { src: "/images/hero-banner.jpg", position: "center 58%" },
  projects: { src: "/images/banners/projets.jpg", position: "center 30%" },
  news: { src: "/images/banners/actualites.jpg", position: "center 55%" },
  events: { src: "/images/banners/agenda.jpg", position: "center 35%" },
  join: { src: "/images/banners/rejoindre.jpg", position: "center 50%" },
  contact: { src: "/images/banners/contact.jpg", position: "center 35%" },
  donate: { src: "/images/banners/don.jpg", position: "center 30%" },
  account: { src: "/images/banners/espace.jpg", position: "center 55%" },
};

export default function PageBanner({ name }) {
  const { src, position } = BANNERS[name];
  return (
    <div className="page-banner" aria-hidden="true" data-header-overlay>
      <Image src={src} alt="" fill preload sizes="100vw" style={{ objectPosition: position }} />
    </div>
  );
}
