// Equivalents "serveur" de quelques composants de src/components/ui : ceux-ci recoivent une icone
// (fonction), ce qui ne peut pas traverser la frontiere serveur -> client. Memes classes CSS.
import Link from "next/link";
import { Inbox } from "lucide-react";
import { cx } from "./helpers";

// Lien presente comme un bouton (href deja localise : useLocalePath()).
export function LinkButton({ href, variant, size, block, icon: Icon, iconRight: IconRight, className, children, ...props }) {
  const classes = cx(
    "btn",
    variant && `btn--${variant}`,
    size && `btn--${size}`,
    block && "btn--block",
    !children && Icon && "btn--icon",
    className
  );
  return (
    <Link href={href} className={classes} {...props}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
      {IconRight && <IconRight aria-hidden="true" />}
    </Link>
  );
}

export function Empty({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="state">
      <span className="state__icon"><Icon size={24} aria-hidden="true" /></span>
      <span className="state__title">{title}</span>
      {description && <p className="muted" style={{ maxWidth: 440, margin: 0 }}>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone }) {
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
