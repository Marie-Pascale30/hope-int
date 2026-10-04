"use client";

// Visuel de couverture (next/image) avec repli sur l'illustration par defaut si l'image ne charge pas.
import { useState } from "react";
import Image from "next/image";
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

// variant : undefined (3/2) | "wide" (21/9) ; sizes : cle de IMAGE_SIZES ou valeur libre.
export default function CoverImage({ src, alt = "", variant, className, priority, sizes = "card" }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const url = failedSrc === src ? PLACEHOLDER : imageSrc(src);
  return (
    <div className={cx("cover pub-cover", variant && `pub-cover--${variant}`, className)}>
      <Image
        src={url}
        alt={alt}
        fill
        sizes={IMAGE_SIZES[sizes] || sizes}
        preload={Boolean(priority)}
        unoptimized={isUnoptimizedImage(url)}
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
