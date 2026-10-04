// Pied de page (composant serveur) : les coordonnees viennent de GET /meta, chargees par le layout.
// Selecteurs de langue et de theme : ilots client.
import { Mail, MapPin, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import Logo from "./Logo";
import LocaleSwitcher from "./LocaleSwitcher";
import ThemeSwitcher from "../ThemeSwitcher";
import { Link, useLocalePath } from "../../i18n/navigation";

const DEFAULT_ORGANIZATION = { name: "HOPE International", email: "", phone: "", address: "" };

export default function SiteFooter({ organization }) {
  const t = useTranslations();
  const lp = useLocalePath();
  const org = { ...DEFAULT_ORGANIZATION, ...(organization || {}) };

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo href={lp("/")} label={t("nav.home")} light />
          <p>{t("footer.tagline")}</p>
          <div className="site-footer__prefs">
            <LocaleSwitcher onDark />
            <ThemeSwitcher onDark />
          </div>
        </div>

        <div>
          <h2 className="site-footer__title">{t("footer.explore")}</h2>
          <ul>
            <li><Link href="/projets">{t("nav.projects")}</Link></li>
            <li><Link href="/actualites">{t("nav.news")}</Link></li>
            <li><Link href="/evenements">{t("nav.events")}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="site-footer__title">{t("footer.act")}</h2>
          <ul>
            <li><Link href="/don">{t("nav.donate")}</Link></li>
            <li><Link href="/rejoindre">{t("nav.join")}</Link></li>
            <li><Link href="/espace">{t("nav.account")}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="site-footer__title">{t("footer.contact")}</h2>
          <ul className="site-footer__contact">
            {org.address && <li><MapPin size={16} aria-hidden="true" /> {org.address}</li>}
            {org.email && <li><Mail size={16} aria-hidden="true" /> <a href={`mailto:${org.email}`}>{org.email}</a></li>}
            {org.phone && <li><Phone size={16} aria-hidden="true" /> <a href={`tel:${org.phone.replace(/\s+/g, "")}`}>{org.phone}</a></li>}
            <li><Link href="/contact">{t("nav.contact")} →</Link></li>
          </ul>
        </div>
      </div>
      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} {org.name}. {t("footer.rights")}</span>
      </div>
    </footer>
  );
}
