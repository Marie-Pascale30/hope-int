"use client";

// Etat d'erreur d'une page rendue cote serveur : "Reessayer" relance le rendu (router.refresh).
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui";

export default function LoadError({ title, message }) {
  const t = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon"><AlertCircle size={24} aria-hidden="true" /></span>
      <span className="state__title">{title || t("loadTitle")}</span>
      <p className="muted" style={{ maxWidth: 440, margin: 0 }}>{message || t("loadText")}</p>
      <Button variant="secondary" size="sm" loading={pending} onClick={() => startTransition(() => router.refresh())}>
        {t("retry")}
      </Button>
    </div>
  );
}
