"use client";

// Visionneuse de photos accessible : <dialog> modal (le reste de la page devient inerte), focus
// maintenu dans la fenetre (Tab / Maj+Tab), Echap ferme, fleches gauche / droite pour naviguer,
// balayage horizontal au doigt, legende et compteur "Image x / y" annonces.
// Le focus revient a l'element declencheur a la fermeture (gere par l'appelant : onClose).
import { useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { imageSrc, isUnoptimizedImage } from "@/src/views/site/components/helpers";

const FOCUSABLE = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
const SWIPE_MIN = 50;

// items : [{ src, width, height, alt, caption }] ; index : photo affichee (null = fermee).
export default function Lightbox({ items, index, onIndexChange, onClose, label }) {
  const t = useTranslations("site.gallery.lightbox");
  const dialogRef = useRef(null);
  const swipeRef = useRef(null);
  const open = index !== null && index >= 0 && index < items.length;
  const total = items.length;
  const item = open ? items[index] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector(".lightbox__close")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const go = (step) => onIndexChange((index + step + total) % total);

  const onKeyDown = (event) => {
    if (event.key === "ArrowRight" && total > 1) {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft" && total > 1) {
      event.preventDefault();
      go(-1);
    } else if (event.key === "Tab") {
      const nodes = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  // Echap : l'evenement "cancel" du dialogue est intercepte pour que l'etat React reste maitre.
  const onCancel = (event) => {
    event.preventDefault();
    onClose();
  };

  // Clic sur le fond (hors de la photo et des commandes) : fermeture.
  const onClick = (event) => {
    if (event.target === dialogRef.current || event.target.classList.contains("lightbox__stage")) onClose();
  };

  const onPointerDown = (event) => {
    if (event.pointerType !== "mouse") swipeRef.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || total < 2) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(dx < 0 ? 1 : -1);
  };

  const url = item ? imageSrc(item.src) : null;

  return (
    <dialog
      ref={dialogRef}
      className="lightbox"
      aria-label={label || t("label")}
      onKeyDown={onKeyDown}
      onCancel={onCancel}
      onClick={onClick}
    >
      {item && (
        <div className="lightbox__frame">
          <div className="lightbox__bar">
            <p className="lightbox__counter" aria-live="polite" aria-atomic="true">
              {t("counter", { current: index + 1, total })}
            </p>
            <button type="button" className="lightbox__btn lightbox__close" onClick={onClose} aria-label={t("close")}>
              <X aria-hidden="true" />
            </button>
          </div>
          <figure className="lightbox__figure">
            <div className="lightbox__stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
              <Image
                key={url}
                src={url}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes="(max-width: 960px) 100vw, 90vw"
                unoptimized={isUnoptimizedImage(url)}
                className="lightbox__img"
              />
            </div>
            <figcaption className="lightbox__caption">{item.caption || item.alt}</figcaption>
          </figure>
          {total > 1 && (
            <div className="lightbox__nav">
              <button type="button" className="lightbox__btn" onClick={() => go(-1)} aria-label={t("previous")}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className="lightbox__btn" onClick={() => go(1)} aria-label={t("next")}>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
