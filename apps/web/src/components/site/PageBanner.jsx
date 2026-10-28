// Bandeau photo d'ouverture : passe sous l'en-tete transparent (qui y est en clair : data-header-overlay)
// et se fond dans le hero qui le suit. A placer juste avant le hero, en premier enfant de la page.
// Photos du livret partenaires de l'association (public/images/livret, catalogue @hope/shared/photos) ;
// position = object-position du recadrage panoramique.
import Image from "next/image";
import { photoUrl } from "@hope/shared/photos";

const banner = (id, position) => ({ src: photoUrl(id), position });

export const BANNERS = {
  home: banner("p11_00", "center 45%"), // enfants de l'orphelinat Petit Dan & Sarah, rentree 2023
  about: banner("p03_12", "center 30%"), // l'equipe HOPE
  gallery: banner("p09_08", "center 30%"), // Noel 2022 a Douala
  projects: banner("p14_11", "center 55%"), // Noel 2023, orphelinat Le Bon Berger
  news: banner("p09_05", "center 30%"), // Noel 2022 a Douala
  events: banner("p18_03", "center 35%"), // 8 mars 2024 a Douala
  join: banner("p05_03", "center 40%"), // membres de l'equipe, mains reunies
  contact: banner("p04_02", "center 25%"), // reunion de l'equipe
  donate: banner("p11_03", "center 40%"), // remise de vivres et fournitures, rentree 2023
  thanks: banner("p13_09", "center 30%"), // coeurs avec les mains, Noel 2023 a Bonaberi
  account: banner("p25_02", "center 35%"), // rentree 2025 a Yaounde
  auth: banner("p20_07", "center 40%"), // rentree 2024 a Yaounde
  team: banner("p11_07", "center 30%"), // membres de HOPE avec Dieu Merci
  transparency: banner("p17_01", "center 35%"), // remise d'un cheque de soutien, 8 mars 2024
  legal: banner("p03_12", "center 30%"), // l'equipe HOPE (mentions legales, confidentialite)
};

export default function PageBanner({ name }) {
  const { src, position } = BANNERS[name];
  return (
    <div className="page-banner" aria-hidden="true" data-header-overlay>
      <Image src={src} alt="" fill preload sizes="100vw" style={{ objectPosition: position }} />
    </div>
  );
}
