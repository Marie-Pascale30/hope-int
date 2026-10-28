// Mentions legales et politique de confidentialite (composants serveur, contenu statique).
// Textes : legal.json (legal.notice, legal.privacy). Chaque section de "sections" est rendue dans
// l'ordre du dictionnaire : "title" -> titre, cle "list..." -> liste a puces, autre cle -> paragraphe.
// Balises disponibles dans les textes : <strong>, <mail> (email de l'association), <account>
// (espace membre, onglet profil), <prefs> (preferences), <contact>, <privacy>, <notice>, <site>.
// Coordonnees : GET /meta (organization), completees par les valeurs de repli (organization.js).
import "../../styles/public.css";
import "../../styles/legal.css";
import { useTranslations } from "next-intl";
import PageBanner from "../../components/site/PageBanner";
import { Link } from "../../i18n/navigation";
import { PublicHero } from "./components";
import { LEGAL_UPDATED_AT, legalConfig, siteHost } from "./legal";
import { FACEBOOK_URL, telHref, withOrganizationDefaults } from "./organization";
import { SITE_URL } from "./seo";

const FACEBOOK = process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || FACEBOOK_URL;

function richTags(org) {
  return {
    strong: (chunks) => <strong>{chunks}</strong>,
    mail: (chunks) => <a href={`mailto:${org.email}`}>{chunks}</a>,
    site: (chunks) => <a href={SITE_URL}>{chunks}</a>,
    account: (chunks) => <Link href="/espace?onglet=profil">{chunks}</Link>,
    prefs: (chunks) => <Link href="/preferences">{chunks}</Link>,
    contact: (chunks) => <Link href="/contact">{chunks}</Link>,
    privacy: (chunks) => <Link href="/confidentialite">{chunks}</Link>,
    notice: (chunks) => <Link href="/mentions-legales">{chunks}</Link>,
  };
}

function LegalUpdated() {
  const t = useTranslations("legal.common");
  return (
    <p className="legal-updated">
      {t.rich("updated", {
        date: new Date(`${LEGAL_UPDATED_AT}T12:00:00Z`),
        time: (chunks) => <time dateTime={LEGAL_UPDATED_AT}>{chunks}</time>,
      })}
    </p>
  );
}

// Sommaire et sections generiques d'un document (page = "notice" | "privacy").
function LegalSections({ page, values, before }) {
  const t = useTranslations(`legal.${page}`);
  const tCommon = useTranslations("legal.common");
  const sections = Object.entries(t.raw("sections"));
  const rich = (key) => t.rich(key, values);
  const anchor = (key) => `${page}-${key}`;

  return (
    <>
      <nav className="legal-toc" aria-labelledby={`${page}-toc`}>
        <h2 id={`${page}-toc`} className="legal-toc__title">{tCommon("toc")}</h2>
        <ol>
          {before?.map(({ id, title }) => (
            <li key={id}><a href={`#${id}`}>{title}</a></li>
          ))}
          {sections.map(([key]) => (
            <li key={key}><a href={`#${anchor(key)}`}>{t(`sections.${key}.title`)}</a></li>
          ))}
        </ol>
      </nav>
      {before?.map(({ id, title, content }) => (
        <section key={id} className="legal-section" aria-labelledby={id}>
          <h2 id={id}>{title}</h2>
          {content}
        </section>
      ))}
      {sections.map(([key, section]) => (
        <section key={key} className="legal-section" aria-labelledby={anchor(key)}>
          <h2 id={anchor(key)}>{t(`sections.${key}.title`)}</h2>
          {Object.entries(section)
            .filter(([part]) => part !== "title")
            .map(([part, content]) =>
              part.startsWith("list") && content && typeof content === "object" ? (
                <ul key={part}>
                  {Object.keys(content).map((item) => (
                    <li key={item}>{rich(`sections.${key}.${part}.${item}`)}</li>
                  ))}
                </ul>
              ) : (
                <p key={part}>{rich(`sections.${key}.${part}`)}</p>
              )
            )}
        </section>
      ))}
    </>
  );
}

function LegalPage({ page, values, before }) {
  const t = useTranslations(`legal.${page}`);
  return (
    <>
      <PageBanner name="legal" />
      <PublicHero eyebrow={t("eyebrow")} title={t("title")} lead={t.rich("lead", values)}>
        <LegalUpdated />
      </PublicHero>
      <section className="section section--tight">
        <div className="container">
          <article className="legal-doc prose">
            <LegalSections page={page} values={values} before={before} />
          </article>
        </div>
      </section>
    </>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function LegalNoticeView({ organization }) {
  const t = useTranslations("legal.notice");
  const tFooter = useTranslations("footer");
  const org = withOrganizationDefaults(organization);
  const config = legalConfig();
  const host = siteHost(SITE_URL);
  const values = { ...richTags(org), name: org.name, host, email: org.email };
  const director = config.publicationDirector || t("publisher.president", { name: org.president });

  const publisher = (
    <dl className="legal-facts">
      <Fact label={t("publisher.name")}>{org.name}</Fact>
      <Fact label={t("publisher.form")}>{t("publisher.formValue")}</Fact>
      {config.registrationNumber && <Fact label={t("publisher.registration")}>{config.registrationNumber}</Fact>}
      <Fact label={t("publisher.seat")}>
        {org.address}
        {org.poBox && <><br />{tFooter("poBox", { number: org.poBox })}</>}
      </Fact>
      <Fact label={t("publisher.email")}><a href={`mailto:${org.email}`}>{org.email}</a></Fact>
      <Fact label={t("publisher.phones")}>
        <span className="legal-facts__list">
          {org.phones.map((phone) => <a key={phone} href={telHref(phone)}>{phone}</a>)}
        </span>
      </Fact>
      <Fact label={t("publisher.facebook")}>
        <a href={FACEBOOK} target="_blank" rel="noopener noreferrer">{t("publisher.facebookLink")}</a>
      </Fact>
      <Fact label={t("publisher.site")}><a href={SITE_URL}>{host}</a></Fact>
      <Fact label={t("publisher.director")}>{director}</Fact>
    </dl>
  );

  const { name: hostName, address: hostAddress, contact: hostContact } = config.host;
  const hosting = hostName ? (
    <dl className="legal-facts">
      <Fact label={t("hosting.name")}>{hostName}</Fact>
      {hostAddress && <Fact label={t("hosting.address")}>{hostAddress}</Fact>}
      {hostContact && <Fact label={t("hosting.contact")}>{hostContact}</Fact>}
    </dl>
  ) : null;

  const before = [
    { id: "notice-publisher", title: t("publisher.title"), content: publisher },
    ...(hosting ? [{ id: "notice-hosting", title: t("hosting.title"), content: hosting }] : []),
  ];

  return <LegalPage page="notice" values={values} before={before} />;
}

export function PrivacyPolicyView({ organization }) {
  const org = withOrganizationDefaults(organization);
  const { retention } = legalConfig();
  const values = {
    ...richTags(org),
    name: org.name,
    host: siteHost(SITE_URL),
    email: org.email,
    address: org.address,
    ...retention,
  };
  return <LegalPage page="privacy" values={values} />;
}
