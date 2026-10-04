// Accueil (composant serveur) : les donnees sont chargees par app/[locale]/page.jsx.
// Une source en erreur n'empeche pas l'affichage des autres (contenu partiel + message).
import "../../styles/public.css";
import { ArrowRight, GraduationCap, HandCoins, Heart, Quote, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, Card } from "../../components/ui";
import { useFormat } from "../../i18n/format";
import { useLocalePath } from "../../i18n/navigation";
import { CoverImage, EventCard, LinkButton, NewsCard, ProjectCard } from "./components";
import LoadError from "./components/LoadError";
import { euros, hasCampaign } from "./components/helpers";

const APPROACH = [
  { icon: GraduationCap, key: "training" },
  { icon: HandCoins, key: "microfinance", accent: true },
  { icon: Users, key: "solidarity" },
];

function ImpactBand({ impact }) {
  const t = useTranslations("site.home.impact");
  const f = useFormat();
  const items = [
    { value: f.number(impact.beneficiaries), label: t("beneficiaries") },
    { value: f.number(impact.trainees), label: t("trainees") },
    { value: f.number(impact.creditsGranted), label: t("credits") },
    { value: f.number(impact.regionsCovered), label: t("regions") },
    { value: euros(f, impact.totalRaisedEur), label: t("raised") },
    { value: f.number(impact.donors), label: t("donors") },
  ];
  return (
    <section className="home-impact" aria-labelledby="home-impact-title">
      <div className="container">
        <div className="home-impact__head">
          <div>
            <span className="eyebrow">{t("eyebrow")}</span>
            <h2 id="home-impact-title">{t("title")}</h2>
          </div>
          <p>{t("text")}</p>
        </div>
        <ul className="home-impact__grid">
          {items.map((item) => (
            <li key={item.label}>
              <span className="home-impact__value">{item.value}</span>
              <span className="home-impact__label">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function HomeView({ impact, projects, testimonials, news, events, failed }) {
  const t = useTranslations("site.home");
  const f = useFormat();
  const lp = useLocalePath();

  const campaigns = (projects || []).filter(hasCampaign).slice(0, 3);
  const quotes = (testimonials || []).slice(0, 3);
  const latestNews = (news || []).slice(0, 3);
  const nextEvents = (events || []).slice(0, 3);

  return (
    <>
      <section className="home-hero">
        <div className="container home-hero__grid">
          <div>
            <span className="eyebrow">{t("eyebrow")}</span>
            <h1>{t("title")}</h1>
            <p className="lead">{t("lead")}</p>
            <div className="home-hero__actions">
              <LinkButton href={lp("/don")} variant="accent" size="lg" icon={Heart}>{t("ctaDonate")}</LinkButton>
              <LinkButton href={lp("/projets")} variant="secondary" size="lg" iconRight={ArrowRight}>{t("ctaDiscover")}</LinkButton>
            </div>
          </div>
          <div className="home-hero__visual">
            <CoverImage src="/images/hero.svg" className="home-hero__frame" priority sizes="hero" />
            {impact?.beneficiaries > 0 && (
              <div className="home-hero__float">
                <span className="pub-feature__icon"><Users aria-hidden="true" /></span>
                <span>
                  {t.rich("heroFloat", {
                    count: impact.beneficiaries,
                    value: f.number(impact.beneficiaries),
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {impact && <ImpactBand impact={impact} />}

      {failed && (
        <div className="container section--tight">
          <LoadError title={t("partialError")} />
        </div>
      )}

      <section className="section" aria-labelledby="home-approach-title">
        <div className="container">
          <div className="section-head section-head--center">
            <span className="eyebrow">{t("approach.eyebrow")}</span>
            <h2 id="home-approach-title">{t("approach.title")}</h2>
            <p>{t("approach.text")}</p>
          </div>
          <div className="grid grid--3 home-approach">
            {APPROACH.map(({ icon: Icon, key, accent }) => (
              <Card key={key} className={`pub-feature${accent ? " pub-feature--accent" : ""}`}>
                <span className="pub-feature__icon"><Icon aria-hidden="true" /></span>
                <h3>{t(`approach.${key}.title`)}</h3>
                <p>{t(`approach.${key}.text`)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {campaigns.length > 0 && (
        <section className="section section--alt" aria-labelledby="home-campaigns-title">
          <div className="container">
            <div className="pub-head-row">
              <div className="section-head">
                <span className="eyebrow">{t("campaigns.eyebrow")}</span>
                <h2 id="home-campaigns-title">{t("campaigns.title")}</h2>
                <p>{t("campaigns.text")}</p>
              </div>
              <LinkButton href={lp("/projets")} variant="secondary" iconRight={ArrowRight}>{t("campaigns.all")}</LinkButton>
            </div>
            <div className="grid grid--3">
              {campaigns.map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="section" aria-labelledby="home-quotes-title">
          <div className="container">
            <div className="section-head section-head--center">
              <span className="eyebrow">{t("quotes.eyebrow")}</span>
              <h2 id="home-quotes-title">{t("quotes.title")}</h2>
            </div>
            <div className="grid grid--3">
              {quotes.map((quote) => (
                <Card key={quote.id} as="figure" className="home-quote">
                  <Quote className="home-quote__mark" aria-hidden="true" />
                  <blockquote>{t("quotes.quoted", { text: quote.content })}</blockquote>
                  <figcaption>
                    <Avatar name={quote.author} large />
                    <span>
                      <strong>{quote.author}</strong>
                      {quote.role_label && <span>{quote.role_label}</span>}
                    </span>
                  </figcaption>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {latestNews.length > 0 && (
        <section className={`section${quotes.length > 0 ? " section--alt" : ""}`} aria-labelledby="home-news-title">
          <div className="container">
            <div className="pub-head-row">
              <div className="section-head">
                <span className="eyebrow">{t("news.eyebrow")}</span>
                <h2 id="home-news-title">{t("news.title")}</h2>
              </div>
              <LinkButton href={lp("/actualites")} variant="secondary" iconRight={ArrowRight}>{t("news.all")}</LinkButton>
            </div>
            <div className="grid grid--3">
              {latestNews.map((item) => <NewsCard key={item.id} item={item} />)}
            </div>
          </div>
        </section>
      )}

      {nextEvents.length > 0 && (
        <section className="section" aria-labelledby="home-events-title">
          <div className="container">
            <div className="pub-head-row">
              <div className="section-head">
                <span className="eyebrow">{t("events.eyebrow")}</span>
                <h2 id="home-events-title">{t("events.title")}</h2>
                <p>{t("events.text")}</p>
              </div>
              <LinkButton href={lp("/evenements")} variant="secondary" iconRight={ArrowRight}>{t("events.all")}</LinkButton>
            </div>
            <div className="pub-events pub-events--compact">
              {nextEvents.map((event) => <EventCard key={event.id} event={event} compact />)}
            </div>
          </div>
        </section>
      )}

      <section className="section section--tight" aria-labelledby="home-cta-title">
        <div className="container">
          <div className="home-cta">
            <div>
              <h2 id="home-cta-title">{t("ctaTitle")}</h2>
              <p>{t("ctaText")}</p>
            </div>
            <div className="home-cta__actions">
              <LinkButton href={lp("/don")} variant="accent" size="lg" icon={Heart}>{t("ctaDonate")}</LinkButton>
              <LinkButton href={lp("/rejoindre")} variant="light" size="lg">{t("ctaJoin")}</LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
