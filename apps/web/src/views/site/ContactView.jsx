// Page contact (composant serveur) ; formulaire dans l'ilot ContactForm.
import "../../styles/public.css";
import { Heart, Mail, MapPin, Phone, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "../../components/ui";
import { useLocalePath } from "../../i18n/navigation";
import { LinkButton, PublicHero } from "./components";
import ContactForm from "./components/ContactForm";

export default function ContactView({ organization = {} }) {
  const t = useTranslations("site.contact");
  const lp = useLocalePath();

  return (
    <>
      <PublicHero eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <section className="section section--tight">
        <div className="container pub-form-layout">
          <div className="stack" style={{ gap: 20 }}>
            <Card>
              <h2 className="pub-aside__title">{t("details")}</h2>
              <ul className="pub-contact-list">
                {organization.email && (
                  <li>
                    <span className="pub-feature__icon"><Mail aria-hidden="true" /></span>
                    <div><span>{t("email")}</span><a href={`mailto:${organization.email}`}>{organization.email}</a></div>
                  </li>
                )}
                {organization.phone && (
                  <li>
                    <span className="pub-feature__icon"><Phone aria-hidden="true" /></span>
                    <div><span>{t("phone")}</span><a href={`tel:${organization.phone.replace(/\s+/g, "")}`}>{organization.phone}</a></div>
                  </li>
                )}
                <li>
                  <span className="pub-feature__icon"><MapPin aria-hidden="true" /></span>
                  <div><span>{t("office")}</span><strong>{organization.address || t("defaultAddress")}</strong></div>
                </li>
              </ul>
            </Card>
            <Card className="pub-mini-cta pub-mini-cta--accent">
              <h3>{t("donateTitle")}</h3>
              <p>{t("donateText")}</p>
              <LinkButton href={lp("/don")} variant="accent" size="sm" icon={Heart}>{t("donateCta")}</LinkButton>
            </Card>
            <Card className="pub-mini-cta pub-mini-cta--brand">
              <h3>{t("joinTitle")}</h3>
              <p>{t("joinText")}</p>
              <LinkButton href={lp("/rejoindre")} size="sm" icon={UsersRound}>{t("joinCta")}</LinkButton>
            </Card>
          </div>

          <ContactForm />
        </div>
      </section>
    </>
  );
}
