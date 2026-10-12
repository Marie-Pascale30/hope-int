import { useMemo } from "react";
import { useTranslations } from "next-intl";

// Boites de dialogue SweetAlert, chargee a la demande (import dynamique) : la bibliotheque
// n'alourdit pas le premier chargement des pages qui n'ouvrent jamais de boite de dialogue.
// - Composants traduits : const alerts = useAlerts(); alerts.confirmAction(title, text, confirmText?, { danger })
//   (libelles des boutons par defaut dans la langue courante : common.json > ui.alerts).
// - Fonctions directes (toast, showSuccess, showError, showInfo, confirmAction) : libelles francais
//   par defaut, surchargeables via le dernier parametre ({ confirmText, cancelText }).
// Toutes les fonctions renvoient une promesse.

// Libelles francais par defaut (fonctions appelees hors composant / back-office en cours de migration).
const FR_LABELS = { ok: "OK", close: "Fermer", understood: "J'ai compris", confirm: "Confirmer", cancel: "Annuler" };

const baseConfig = {
  width: "32rem",
  // Variables CSS acceptees dans le style en ligne : suit le theme clair / sombre.
  backdrop: "var(--backdrop)",
  customClass: {
    popup: "hope-swal-popup",
    title: "hope-swal-title",
    htmlContainer: "hope-swal-text",
    actions: "hope-swal-actions",
    confirmButton: "hope-swal-confirm",
    cancelButton: "hope-swal-cancel",
  },
  buttonsStyling: false,
};

let swalPromise = null;
const loadSwal = () => {
  if (!swalPromise) {
    swalPromise = import("sweetalert2").then((module) => module.default).catch((error) => {
      swalPromise = null;
      throw error;
    });
  }
  return swalPromise;
};

let toastMixin = null;

export async function toast(title, icon = "success") {
  const Swal = await loadSwal();
  if (!toastMixin) {
    toastMixin = Swal.mixin({
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 3200,
      timerProgressBar: true,
      customClass: { popup: "hope-swal-toast" },
    });
  }
  return toastMixin.fire({ icon, title });
}

export async function showSuccess(title, text, { confirmText = FR_LABELS.ok } = {}) {
  const Swal = await loadSwal();
  await Swal.fire({ ...baseConfig, icon: "success", title, text, confirmButtonText: confirmText });
}

export async function showError(title, text, { confirmText = FR_LABELS.close } = {}) {
  const Swal = await loadSwal();
  await Swal.fire({ ...baseConfig, icon: "error", title, text, confirmButtonText: confirmText });
}

export async function showInfo(title, html, { confirmText = FR_LABELS.understood } = {}) {
  const Swal = await loadSwal();
  await Swal.fire({ ...baseConfig, icon: "info", title, html, confirmButtonText: confirmText });
}

// Confirmation avant une action ; `danger` colore le bouton en rouge (suppression...).
export async function confirmAction(title, text, confirmText, { danger = false, cancelText = FR_LABELS.cancel } = {}) {
  const Swal = await loadSwal();
  const result = await Swal.fire({
    ...baseConfig,
    icon: danger ? "warning" : "question",
    title,
    text,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: danger,
    confirmButtonText: confirmText || FR_LABELS.confirm,
    cancelButtonText: cancelText,
    customClass: { ...baseConfig.customClass, confirmButton: danger ? "hope-swal-danger" : "hope-swal-confirm" },
  });
  return result.isConfirmed;
}

// Memes fonctions, avec les libelles des boutons dans la langue courante. Les parametres
// explicites (confirmText, cancelText) priment toujours sur ces valeurs par defaut.
export function useAlerts() {
  const t = useTranslations("ui.alerts");
  return useMemo(() => ({
    toast,
    showSuccess: (title, text, options = {}) => showSuccess(title, text, { confirmText: t("ok"), ...options }),
    showError: (title, text, options = {}) => showError(title, text, { confirmText: t("close"), ...options }),
    showInfo: (title, html, options = {}) => showInfo(title, html, { confirmText: t("understood"), ...options }),
    confirmAction: (title, text, confirmText, options = {}) =>
      confirmAction(title, text, confirmText || t("confirm"), { cancelText: t("cancel"), ...options }),
  }), [t]);
}
