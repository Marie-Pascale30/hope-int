"use client";

// Modale accessible.
import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cx, getFocusable } from "./utils";

// Piege de focus, Echap, restauration du focus a la fermeture, titre relie par aria-labelledby.
// Modales superposees (ex. phototheque ouverte depuis un formulaire) : seule la plus recente
// gere le clavier.
const openStack = [];

export function Modal({ open, title, onClose, children, footer, large, closeLabel }) {
  const t = useTranslations("ui");
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const previous = document.activeElement;

    const token = {};
    openStack.push(token);

    const onKey = (event) => {
      if (openStack[openStack.length - 1] !== token) return;
      // Une boite de dialogue SweetAlert ouverte par-dessus gere elle-meme le clavier.
      if (document.querySelector(".swal2-container")) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = getFocusable(dialog);
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus initial : premier champ du contenu, sinon la boite elle-meme.
    const firstField = dialog?.querySelector(".modal__body input:not([type=\"hidden\"]):not([disabled]), .modal__body select, .modal__body textarea");
    (firstField || dialog)?.focus();

    return () => {
      openStack.splice(openStack.indexOf(token), 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div
        ref={dialogRef}
        className={cx("modal", large && "modal--lg")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__head">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" icon={X} onClick={onClose} aria-label={closeLabel ?? t("close")} />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
