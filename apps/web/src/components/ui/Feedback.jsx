// Etats d'une zone (chargement, vide, erreur). Sans "use client" : utilisables dans les composants
// serveur (sauf onRetry, qui exige un composant client).
import { useTranslations } from "next-intl";
import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "./Button";

export function LoadingState({ label }) {
  const t = useTranslations("ui");
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">{label ?? t("loading")}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  const t = useTranslations("ui");
  return (
    <div className="state">
      <span className="state__icon"><Icon size={24} aria-hidden="true" /></span>
      <span className="state__title">{title ?? t("empty")}</span>
      {description && <p className="muted state__text">{description}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, message, onRetry, retryLabel }) {
  const t = useTranslations("ui");
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon"><AlertCircle size={24} aria-hidden="true" /></span>
      <span className="state__title">{title ?? t("errorTitle")}</span>
      {message && <p className="muted state__text">{message}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>{retryLabel ?? t("retry")}</Button>}
    </div>
  );
}
