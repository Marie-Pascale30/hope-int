import Swal from "sweetalert2";

const baseConfig = {
  width: "32rem",
  backdrop: "rgba(20, 30, 26, 0.5)",
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

const toastMixin = Swal.mixin({
  toast: true,
  position: "bottom-end",
  showConfirmButton: false,
  timer: 3200,
  timerProgressBar: true,
});

export function toast(title, icon = "success") {
  return toastMixin.fire({ icon, title });
}

export async function showSuccess(title, text) {
  await Swal.fire({ ...baseConfig, icon: "success", title, text, confirmButtonText: "OK" });
}

export async function showError(title, text) {
  await Swal.fire({ ...baseConfig, icon: "error", title, text, confirmButtonText: "Fermer" });
}

export async function showInfo(title, html) {
  await Swal.fire({ ...baseConfig, icon: "info", title, html, confirmButtonText: "J'ai compris" });
}

// Confirmation avant une action ; `danger` colore le bouton en rouge (suppression...).
export async function confirmAction(title, text, confirmText = "Confirmer", { danger = false } = {}) {
  const result = await Swal.fire({
    ...baseConfig,
    icon: danger ? "warning" : "question",
    title,
    text,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: danger,
    confirmButtonText: confirmText,
    cancelButtonText: "Annuler",
    customClass: { ...baseConfig.customClass, confirmButton: danger ? "hope-swal-danger" : "hope-swal-confirm" },
  });
  return result.isConfirmed;
}
