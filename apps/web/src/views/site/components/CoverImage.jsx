"use client";

// Visuel de couverture (next/image) avec repli sur l'illustration par defaut si l'image ne charge pas.
import { useState } from "react";
import Image from "next/image";
import { useDataSaver } from "@/src/components/eco/DataSaver";
import { PLACEHOLDER, cx, imageSrc, isUnoptimizedImage } from "./helpers";

// Tailles d'affichage courantes (attribut sizes), alignees sur les points de rupture 480/768/960/1200.
export const IMAGE_SIZES = {
  card: "(max-width: 768px) calc(100vw - 32px), (max-width: 1200px) 50vw, 380px",
  featured: "(max-width: 960px) calc(100vw - 32px), 640px",
  wide: "(max-width: 1200px) calc(100vw - 32px), 1200px",
  article: "(max-width: 960px) calc(100vw - 32px), 820px",
  thumb: "(max-width: 768px) calc(100vw - 32px), 280px",
  hero: "(max-width: 960px) calc(100vw - 32px), 560px",
};

// Mode eco donnees : largeur demandee reduite (variante la plus petite du srcset) et qualite basse.
// La qualite 40 doit figurer dans images.qualities de next.config.js (sinon Next prend la plus proche).
export const ECO_SIZES = "(max-width: 768px) 50vw, 240px";
export const ECO_QUALITY = 40;

// variant : undefined (3/2) | "wide" (21/9) ; sizes : cle de IMAGE_SIZES ou valeur libre.
// alt : texte alternatif saisi dans l'administration (champ image_alt) ; absent, l'image est
// consideree comme decorative (alt vide) : le titre voisin porte deja l'information.
// L'illustration de repli est toujours decorative.
export default function CoverImage({ src, alt, variant, className, priority, sizes = "card" }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const eco = useDataSaver();
  const url = failedSrc === src ? PLACEHOLDER : imageSrc(src);
  return (
    <div className={cx("cover pub-cover", variant && `pub-cover--${variant}`, className)}>
      <Image
        src={url}
        alt={url === PLACEHOLDER ? "" : (alt || "").trim()}
        fill
        sizes={IMAGE_SIZES[sizes] || sizes}
        preload={Boolean(priority)}
        unoptimized={isUnoptimizedImage(url)}
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
