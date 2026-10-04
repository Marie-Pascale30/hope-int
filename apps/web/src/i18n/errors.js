import { useCallback } from "react";
import { useTranslations } from "next-intl";

// Message d'erreur lisible a partir d'une erreur axios. t : useTranslations("errors").
// Le message renvoye par l'API (data.error) est affiche tel quel : l'API le traduit d'apres
// Accept-Language ; seuls les replis (champ invalide, reseau, delai, erreur inconnue) sont traduits ici.
export function errorMessage(t, error) {
  const data = error?.response?.data;
  if (data?.error) return data.error;
  if (Array.isArray(data?.errors) && data.errors.length) {
    const first = data.errors[0];
    return t("invalidField", { field: first.path || "?" });
  }
  if (error?.code === "ECONNABORTED") return t("timeout");
  if (error?.message === "Network Error") return t("network");
  return t("generic");
}

// Dans un composant : const errorText = useErrorMessage(); errorText(err)
export function useErrorMessage() {
  const t = useTranslations("errors");
  return useCallback((error) => errorMessage(t, error), [t]);
}
