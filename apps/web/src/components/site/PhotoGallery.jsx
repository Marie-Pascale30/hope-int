"use client";

// Galerie de photos reutilisable (page Galerie, accueil, parcours "Qui sommes-nous", projets et
// actualites) : chaque vignette est un bouton qui ouvre la visionneuse (Lightbox).
// variant : "masonry" (colonnes, proportions d'origine) | "mosaic" (grille de carres) |
// "strip" (petites vignettes, limit premieres + bouton "+n" qui ouvre la suite).
// items : [{ id, src, width, height, alt, caption }] (voir src/views/site/gallery.js).
import "@/src/styles/gallery.css";
import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useDataSaver } from "@/src/components/eco/DataSaver";
import { ECO_QUALITY, ECO_SIZES } from "@/src/views/site/components/CoverImage";
import { cx, imageSrc, isUnoptimizedImage } from "@/src/views/site/components/helpers";
import Lightbox from "./Lightbox";

const SIZES = {
  masonry: "(max-width: 640px) calc(50vw - 24px), (max-width: 1024px) calc(33vw - 24px), 300px",
  mosaic: "(max-width: 640px) calc(50vw - 24px), (max-width: 1024px) calc(33vw - 24px), 290px",
  strip: "72px",
};

export default function PhotoGallery({ items, variant = "masonry", limit, label, className }) {
  const t = useTranslations("site.gallery.lightbox");
  const eco = useDataSaver();
  const [index, setIndex] = useState(null);
  const openerRef = useRef(null);
  if (!items?.length) return null;

  const shown = limit && items.length > limit ? items.slice(0, limit) : items;
  const hidden = items.length - shown.length;
  const square = variant !== "masonry";

  const open = (event, next) => {
    openerRef.current = event.currentTarget;
    setIndex(next);
  };
  const close = () => {
    setIndex(null);
    const opener = openerRef.current;
    requestAnimationFrame(() => opener?.focus());
  };

  return (
    <>
      <ul className={cx("photo-gallery", `photo-gallery--${variant}`, className)} aria-label={label}>
        {shown.map((item, position) => {
          const url = imageSrc(item.src);
          return (
            <li key={item.id || `${item.src}-${position}`} className="photo-gallery__item">
              <button
                type="button"
                className="photo-gallery__btn"
                aria-haspopup="dialog"
                onClick={(event) => open(event, position)}
              >
                <Image
                  src={url}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  sizes={eco && variant !== "strip" ? ECO_SIZES : SIZES[variant]}
                  quality={eco ? ECO_QUALITY : undefined}
                  unoptimized={isUnoptimizedImage(url)}
                  className={square ? "photo-gallery__img photo-gallery__img--cover" : "photo-gallery__img"}
                />
              </button>
            </li>
          );
        })}
        {hidden > 0 && (
          <li className="photo-gallery__item">
            <button
              type="button"
              className="photo-gallery__btn photo-gallery__more"
              aria-haspopup="dialog"
              onClick={(event) => open(event, shown.length)}
              aria-label={t("more", { count: hidden })}
            >
              <span aria-hidden="true">+{hidden}</span>
            </button>
          </li>
        )}
      </ul>
      <Lightbox items={items} index={index} onIndexChange={setIndex} onClose={close} label={label} />
    </>
  );
}
