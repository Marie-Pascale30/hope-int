// Page contact (composant serveur) ; formulaire dans l'ilot ContactForm.
// Coordonnees : GET /meta (organization), completees par les valeurs reelles de repli.
import "../../styles/public.css";
import "../../styles/about.css";
import { Facebook, Heart, Mail, MapPin, Phone, Smartphone, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { hl } from "../../components/motion/hl";
import { Button, Card } from "../../components/ui";
import { useLocalePath } from "../../i18n/navigation";
import PageBanner from "../../components/site/PageBanner";
import { FACEBOOK_URL, telHref, withOrganizationDefaults } from "./organization";
import { PublicHero } from "./components";
import ContactForm from "./components/ContactForm";

const FACEBOOK = process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || FACEBOOK_URL;

function MobileMoneyCard({ mobileMoney }) {
  const t = useTranslations("site.contact.mobileMoney");
  const { mtn, orangeUssd, orangeMerchantCode, sara } = mobileMoney;
  if (!mtn && !orangeUssd && !orangeMerchantCode && !sara) return null;
  return (
    <Card className="pub-mini-cta pub-mini-cta--accent">
      <h2 className="momo__title"><Smartphone size={20} aria-hidden="true" /> {t("title")}</h2>
      <p>{t("text")}</p>
      <dl className="momo">
        {mtn && (
          <div className="momo__row">
            <dt>{t("mtn")}</dt>
            <dd><span>{t("mtnNumber")}</span> <strong>{mtn}</strong></dd>
          </div>
        )}
        {(orangeUssd || orangeMerchantCode) && (
          <div className="momo__row">
            <dt>{t("orange")}</dt>
            {orangeUssd && <dd><span>{t("orangeUssd")}</span> <strong>{orangeUssd}</strong></dd>}
            {orangeMerchantCode && <dd><span>{t("orangeCode")}</span> <strong>{orangeMerchantCode}</strong></dd>}
          </div>
        )}
        {sara && (
          <div className="momo__row">
            <dt>{t("sara")}</dt>
            <dd><span>{t("saraAccount")}</span> <strong>{sara}</strong></dd>
          </div>
        )}
      </dl>
    </Card>
  );
}

export default function ContactView({ organization = {} }) {
  const t = useTranslations("site.contact");
  const tShare = useTranslations("common.share");
  const lp = useLocalePath();
  const org = withOrganizationDefaults(organization);

  return (
    <>
      <PageBanner name="contact" />
      <PublicHero eyebrow={t("eyebrow")} title={t.rich("title", { hl })} lead={t("lead")} />

      <section className="section section--tight">
        <div className="container pub-form-layout">
          <div className="stack" style={{ gap: 20 }}>
            <Card>
              <h2 className="pub-aside__title">{t("details")}</h2>
              <ul className="pub-contact-list">
                <li>
                  <span className="pub-feature__icon"><Phone aria-hidden="true" /></span>
                  <div>
                    <span>{org.phones.length > 1 ? t("phones") : t("phone")}</span>
                    <ul className="contact-phones">
                      {org.phones.map((phone) => (
                        <li key={phone}><a href={telHref(phone)}>{phone}</a></li>
                      ))}
                    </ul>
                  </div>
                </li>
                <li>
                  <span className="pub-feature__icon"><Mail aria-hidden="true" /></span>
                  <div><span>{t("email")}</span><a href={`mailto:${org.email}`}>{org.email}</a></div>
                </li>
                <li>
                  <span className="pub-feature__icon"><MapPin aria-hidden="true" /></span>
                  <div>
                    <span>{t("office")}</span>
                    <strong>{org.address || t("defaultAddress")}</strong>
                    {org.poBox && <strong className="contact-pobox">{t("poBoxValue", { number: org.poBox })}</strong>}
                  </div>
                </li>
                <li>
                  <span className="pub-feature__icon"><Facebook aria-hidden="true" /></span>
                  <div>
                    <span>{t("facebook")}</span>
                    <a href={FACEBOOK} target="_blank" rel="noopener noreferrer">
                      {t("facebookName")} <span className="visually-hidden">{tShare("newWindow")}</span>
                    </a>
                  </div>
                </li>
              </ul>
            </Card>
            <MobileMoneyCard mobileMoney={org.mobileMoney} />
            <Card className="pub-mini-cta pub-mini-cta--brand">
              <h2>{t("donateTitle")}</h2>
              <p>{t("donateText")}</p>
              <Button href={lp("/don")} variant="accent" size="sm" icon={Heart}>{t("donateCta")}</Button>
            </Card>
            <Card className="pub-mini-cta">
              <h2>{t("joinTitle")}</h2>
              <p>{t("joinText")}</p>
              <Button href={lp("/rejoindre")} size="sm" icon={UsersRound}>{t("joinCta")}</Button>
            </Card>
          </div>

          <ContactForm />
        </div>
      </section>
    </>
  );
}
