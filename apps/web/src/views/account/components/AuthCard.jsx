import Link from "next/link";
import { LogoMark } from "../../../components/site/Logo";

// Cadre commun des pages d'authentification : carte centree sur fond creme.
export default function AuthCard({ title, description, children, footer }) {
  return (
    <section className="acc-auth">
      <div className="acc-auth__card">
        <Link href="/" className="acc-auth__logo" aria-label="HOPE International — accueil">
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
