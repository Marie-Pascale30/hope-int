// Bouton ou lien presente comme un bouton. Sans "use client" : utilisable tel quel dans les
// composants serveur (href deja localise : useLocalePath()) comme dans les composants client.
import Link from "next/link";
import { cx } from "./utils";

export function Button({ href, variant, size, block, icon: Icon, iconRight: IconRight, loading, className, children, ...props }) {
  const classes = cx(
    "btn",
    variant && `btn--${variant}`,
    size && `btn--${size}`,
    block && "btn--block",
    !children && Icon && "btn--icon",
    className
  );
  const content = (
    <>
      {loading ? <span className="spinner spinner--sm" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}
      {children}
      {IconRight && <IconRight aria-hidden="true" />}
    </>
  );
  if (href) {
    const external = /^https?:\/\//.test(href);
    return external ? (
      <a href={href} className={classes} {...props}>{content}</a>
    ) : (
      <Link href={href} className={classes} {...props}>{content}</Link>
    );
  }
  return (
    <button type="button" className={classes} disabled={loading || props.disabled} {...props}>
      {content}
    </button>
  );
}
