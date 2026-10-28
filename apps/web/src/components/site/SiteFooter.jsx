// Pied de page (composant serveur) : les coordonnees viennent de GET /meta, chargees par le layout.
// Langue et theme sont dans l'en-tete ; mode eco donnees et newsletter : ilots client.
import "../../views/engagement/engagement.css";
import { Mail, MapPin, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import Logo from "./Logo";
import { DataSaverToggle } from "../eco/DataSaver";
import { Link, useLocalePath } from "../../i18n/navigation";
import NewsletterSignup from "../../views/engagement/NewsletterSignup";
import SocialLinks from "../../views/engagement/SocialLinks";
import { telHref, withOrganizationDefaults } from "../../views/site/organization";

export default function SiteFooter({ organization }) {
  const t = useTranslations();
  const lp = useLocalePath();
  // Coordonnees de l'API, completees par les valeurs reelles de repli (API ancienne ou absente).
  const org = withOrganizationDefaults(organization);

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo href={lp("/")} label={t("nav.home")} light />
          <p>{t("footer.tagline")}</p>
          <div className="site-footer__prefs">
            <DataSaverToggle />
          </div>
        </div>

        <div>
          <h2 className="site-footer__title">{t("footer.explore")}</h2>
          <ul>
            <li><Link href="/a-propos">{t("nav.about")}</Link></li>
            <li><Link href="/galerie">{t("nav.gallery")}</Link></li>
            <li><Link href="/projets">{t("nav.projects")}</Link></li>
            <li><Link href="/actualites">{t("nav.news")}</Link></li>
            <li><Link href="/evenements">{t("nav.events")}</Link></li>
            <li><Link href="/transparence">{t("nav.transparency")}</Link></li>
            <li><Link href="/equipe">{t("nav.team")}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="site-footer__title">{t("footer.act")}</h2>
          <ul>
            <li><Link href="/don">{t("nav.donate")}</Link></li>
            <li><Link href="/rejoindre">{t("nav.join")}</Link></li>
            <li><Link href="/espace">{t("nav.account")}</Link></li>
            <li><Link href="/preferences">{t("engagement.preferences.title")}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="site-footer__title">{t("footer.contact")}</h2>
          <ul className="site-footer__contact">
            <li>
              <MapPin size={16} aria-hidden="true" />{" "}
              <span>{org.address}{org.poBox && <><br />{t("footer.poBox", { number: org.poBox })}</>}</span>
            </li>
            <li><Phone size={16} aria-hidden="true" /> <a href={telHref(org.phone)}>{org.phone}</a></li>
            <li><Mail size={16} aria-hidden="true" /> <a href={`mailto:${org.email}`}>{org.email}</a></li>
            <li><Link href="/contact">{t("nav.contact")} →</Link></li>
          </ul>
        </div>
      </div>
      <div className="container eng-footer-band">
        <NewsletterSignup />
        <SocialLinks />
      </div>
      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} {org.name}. {t("footer.rights")}</span>
      </div>
    </footer>
  );
}
