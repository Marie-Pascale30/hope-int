import { useMemo } from "react";
import { useTranslations } from "next-intl";

// Libelles traduits (messages "labels" de common.json) et tonalites de badge des statuts metier.
// Tonalites disponibles : success | warning | danger | info | brand | accent | (vide = neutre)

export const TONES = {
  projectStatus: { planifie: "info", en_cours: "success", termine: "" },
  messageStatus: { nouveau: "accent", lu: "info", traite: "success", archive: "" },
  applicationStatus: { nouvelle: "accent", en_etude: "info", acceptee: "success", refusee: "danger" },
  paymentStatus: {
    pending: "warning",
    succeeded: "success",
    failed: "danger",
    canceled: "",
    refunded: "info",
    disputed: "danger",
    review: "warning",
  },
  userStatus: { active: "success", inactive: "danger" },
  subscriptionStatus: {
    active: "success",
    trialing: "success",
    past_due: "warning",
    incomplete: "warning",
    canceled: "",
    unpaid: "danger",
    unknown: "",
  },
};

// Cles connues (listes d'options, filtres) : l'ordre est celui de l'affichage.
export const ROLE_KEYS = [
  "admin",
  "directrice_generale",
  "conseiller",
  "responsable_rh",
  "responsable_finance",
  "organisatrice",
  "responsable_it",
  "directrice_regionale",
  "secretaire_generale",
  "membre",
];
export const STATUS_KEYS = Object.fromEntries(Object.entries(TONES).map(([group, tones]) => [group, Object.keys(tones)]));
export const PAYMENT_METHOD_KEYS = ["card", "mobile_money"];
export const FREQUENCY_KEYS = ["once", "monthly"];

// t : traducteur de l'espace "labels" (useTranslations("labels") ou getTranslations cote serveur).
export function makeLabels(t) {
  const text = (group, key, fallback = "—") => (key && t.has(`${group}.${key}`) ? t(`${group}.${key}`) : key || fallback);
  return {
    // status("paymentStatus", "succeeded") -> { label, tone }
    status: (group, key) => ({ label: text(group, key), tone: TONES[group]?.[key] ?? "" }),
    role: (role) => (role ? text("role", role) : t("role.membre")),
    method: (key) => text("paymentMethod", key),
    frequency: (key) => text("frequency", key),
  };
}

export function useLabels() {
  const t = useTranslations("labels");
  return useMemo(() => makeLabels(t), [t]);
}
