import { useTranslations } from "next-intl";
import { LogoMark } from "../../../components/site/Logo";
import { Link } from "../../../i18n/navigation";

// Cadre commun des pages d'authentification : carte centree sur fond creme.
export default function AuthCard({ title, description, children, footer }) {
  const t = useTranslations("nav");
  return (
    <section className="acc-auth">
      <div className="acc-auth__card">
        <Link href="/" className="acc-auth__logo" aria-label={t("home")}>
          <LogoMark size={52} />
        </Link>
        <h1 className="acc-auth__title">{title}</h1>
        {description && <p className="acc-auth__desc">{description}</p>}
        {children}
      </div>
      {footer && <div className="acc-auth__footer">{footer}</div>}
    </section>
  );
}
