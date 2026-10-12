"use client";

// Raccourcis clavier du back-office :
//   "/" : focus sur la recherche de la page (champ marque data-page-search) ;
//   "?" : aide des raccourcis.
// Inactifs pendant la saisie (champ, zone de texte, liste, contenu editable), avec une touche
// de modification (Ctrl, Cmd, Alt) ou quand une boite de dialogue est deja ouverte.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "../ui";

const isTyping = (target) =>
  target instanceof HTMLElement && (
    target.isContentEditable
    || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
    || Boolean(target.closest("[contenteditable='true']"))
  );

const dialogOpen = () => Boolean(document.querySelector("[role='dialog'][aria-modal='true'], .swal2-container"));

function focusPageSearch() {
  const field = [...document.querySelectorAll("[data-page-search]")]
    .find((element) => element.getClientRects().length > 0 && !element.closest("[inert]"));
  if (!field) return false;
  field.focus();
  if (typeof field.select === "function") field.select();
  return true;
}

export default function KeyboardShortcuts() {
  const t = useTranslations("admin.shortcuts");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || dialogOpen()) return;
      if (event.key === "/") {
        if (focusPageSearch()) event.preventDefault();
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Modal open={helpOpen} title={t("title")} onClose={() => setHelpOpen(false)}>
      <p className="muted">{t("intro")}</p>
      <dl className="adm-shortcuts">
        <dt><kbd>/</kbd></dt>
        <dd>{t("search")}</dd>
        <dt><kbd>?</kbd></dt>
        <dd>{t("help")}</dd>
        <dt><kbd>{t("escapeKey")}</kbd></dt>
        <dd>{t("escape")}</dd>
      </dl>
    </Modal>
  );
}
