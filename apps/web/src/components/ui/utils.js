// Utilitaires partages par les composants d'interface (sans etat, utilisables partout).

export const cx = (...classes) => classes.filter(Boolean).join(" ");

// Elements atteignables au clavier (piege de focus des modales, premier champ...).
export const FOCUSABLE = [
  "a[href]", "area[href]", "button:not([disabled])", "input:not([disabled]):not([type=\"hidden\"])",
  "select:not([disabled])", "textarea:not([disabled])", "iframe", "[tabindex]:not([tabindex=\"-1\"])",
  "[contenteditable=\"true\"]",
].join(",");

const isVisible = (element) => element.getClientRects().length > 0;

export function getFocusable(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE)].filter((element) => isVisible(element) && !element.closest("[inert]"));
}

// Met le focus sur le premier champ invalide d'un formulaire (apres le rendu des erreurs).
// Cible les elements aria-invalid="true" ou data-invalid="true" (groupes : premier champ du groupe).
export function focusFirstInvalid(container) {
  if (typeof window === "undefined" || !container) return;
  window.requestAnimationFrame(() => {
    const target = container.querySelector("[aria-invalid=\"true\"], [data-invalid=\"true\"]");
    if (!target) return;
    // Un groupe focalisable (tabindex) recoit le focus lui-meme ; sinon son premier champ.
    const focusable = target.matches(FOCUSABLE) || target.hasAttribute("tabindex")
      ? target
      : getFocusable(target).find((element) => element.tagName !== "IFRAME") || target;
    if (!focusable.matches(FOCUSABLE) && !focusable.hasAttribute("tabindex")) focusable.setAttribute("tabindex", "-1");
    focusable.focus();
    if (typeof focusable.scrollIntoView === "function") {
      focusable.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  });
}
