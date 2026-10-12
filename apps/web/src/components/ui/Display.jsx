// Composants d'affichage purs (sans etat ni effet) : utilisables tels quels dans les composants
// serveur comme dans les composants client. Styles dans src/styles/globals.css.
import { useTranslations } from "next-intl";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { initials as toInitials } from "../../utils/format";
import { cx } from "./utils";

export function Badge({ tone, plain, children, className }) {
  return <span className={cx("badge", tone && `badge--${tone}`, plain && "badge--plain", className)}>{children}</span>;
}

// status : objet { label, tone } issu de utils/labels.js
export function StatusBadge({ status }) {
  if (!status) return null;
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

export function Card({ as: Tag = "div", pad = true, hover, className, children, ...props }) {
  return (
    <Tag className={cx("card", pad && "card--pad", hover && "card--hover", className)} {...props}>
      {children}
    </Tag>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__desc">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

const ALERT_ICONS = { info: Info, warning: AlertTriangle, danger: AlertCircle, success: CheckCircle2 };

export function Alert({ tone = "info", title, children }) {
  const Icon = ALERT_ICONS[tone] || Info;
  return (
    <div className={`alert alert--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden="true" />
      <div>
        {title && <strong className="alert__title">{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({ value = 0, accent, label }) {
  const t = useTranslations("ui");
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={cx("progress", accent && "progress--accent")}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || t("progress")}
    >
      <div className="progress__bar" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone }) {
  return (
    <div className={cx("stat", tone && `stat--${tone}`)}>
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        {Icon && <span className="stat__icon"><Icon aria-hidden="true" /></span>}
      </div>
      <span className="stat__value">{value}</span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

export function Avatar({ name, large }) {
  return <span className={cx("avatar", large && "avatar--lg")} aria-hidden="true">{toInitials(name) || "?"}</span>;
}
