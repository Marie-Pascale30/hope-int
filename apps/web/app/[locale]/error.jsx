"use client";

// Erreur inattendue pendant le rendu d'une page publique : message traduit et nouvel essai.
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui";
import { useLocalePath } from "@/src/i18n/navigation";

export default function PageError({ error, reset }) {
  const t = useTranslations("errors");
  const lp = useLocalePath();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container section">
      <div className="state state--error" role="alert">
        <span className="state__icon"><AlertCircle size={24} aria-hidden="true" /></span>
        <span className="state__title">{t("pageTitle")}</span>
        <p className="muted" style={{ maxWidth: 440, margin: 0 }}>{t("pageText")}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Button variant="secondary" size="sm" onClick={reset}>{t("retry")}</Button>
          <Button href={lp("/")} variant="ghost" size="sm">{t("backHome")}</Button>
        </div>
      </div>
    </div>
  );
}
