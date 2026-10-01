"use client";

import "../../styles/public.css";
import { ArrowRight, GraduationCap, HandCoins, Heart, Quote, Users } from "lucide-react";
import { Avatar, Button, Card, ErrorState } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { useI18n } from "../../i18n";
import { publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatNumber } from "../../utils/format";
import { CardsSkeleton, CoverImage, EventCard, NewsCard, ProjectCard } from "./components";
import { euros, hasCampaign } from "./components/helpers";

const APPROACH = [
  {
    icon: GraduationCap,
    title: "Formation",
    text: "Gestion, comptabilité simple, techniques agricoles, entrepreneuriat : nous transmettons les savoir-faire qui rendent une activité durable.",
  },
  {
    icon: HandCoins,
    title: "Microfinance solidaire",
    text: "Des microcrédits à taux solidaire, accompagnés d’un suivi mensuel. Chaque prêt remboursé finance une nouvelle activité.",
    accent: true,
  },
  {
    icon: Users,
    title: "Groupes solidaires et entraide",
    text: "Coopératives, caisses d’épargne villageoises, mentorat : la force du collectif protège les familles face aux imprévus.",
  },
];

function ImpactBand({ impact, loading }) {
  const items = impact
    ? [
        { value: formatNumber(impact.beneficiaries), label: "Bénéficiaires accompagnés" },
        { value: formatNumber(impact.trainees), label: "Personnes formées" },
        { value: formatNumber(impact.creditsGranted), label: "Microcrédits accordés" },
        { value: formatNumber(impact.regionsCovered), label: "Régions couvertes" },
        { value: euros(impact.totalRaisedEur), label: "Collectés grâce à vous" },
        { value: formatNumber(impact.donors), label: "Donateurs engagés" },
      ]
    : [];
  return (
    <section className="home-impact" aria-labelledby="home-impact-title">
      <div className="container">
        <div className="home-impact__head">
          <div>
            <span className="eyebrow">Notre impact</span>
            <h2 id="home-impact-title">Des résultats concrets, sur le terrain</h2>
          </div>
          <p>Chiffres consolidés de l’ensemble de nos programmes au Cameroun, mis à jour en continu.</p>
        </div>
        {loading ? (
          <div className="home-impact__skeleton skeleton" aria-busy="true" aria-label="Chargement des chiffres clés" />
        ) : (
          <ul className="home-impact__grid">
            {items.map((item) => (
              <li key={item.label}>
                <span className="home-impact__value">{item.value}</span>
                <span className="home-impact__label">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function HomeView() {
  const { t } = useI18n();
  const impact = useAsync(() => publicApi.impact(), []);
  const projects = useAsync(() => publicApi.listContent("projects"), []);
  const testimonials = useAsync(() => publicApi.listContent("testimonials"), []);
  const news = useAsync(() => publicApi.listContent("news"), []);
  const events = useAsync(() => publicApi.listEvents(), []);

  const sources = [impact, projects, testimonials, news, events];
  const failed = sources.filter((source) => source.error);
  const retry = () => failed.forEach((source) => source.reload());

  const campaigns = (projects.data || []).filter(hasCampaign).slice(0, 3);
  const quotes = (testimonials.data || []).slice(0, 3);
  const latestNews = (news.data || []).slice(0, 3);
  const nextEvents = (events.data || []).slice(0, 3);

  return (
    <>
      <section className="home-hero">
        <div className="container home-hero__grid">
          <div>
            <span className="eyebrow">{t("home.eyebrow")}</span>
            <h1>{t("home.title")}</h1>
            <p className="lead">{t("home.lead")}</p>
            <div className="home-hero__actions">
              <Button href="/don" variant="accent" size="lg" icon={Heart}>{t("home.ctaDonate")}</Button>
              <Button href="/projets" variant="secondary" size="lg" iconRight={ArrowRight}>{t("home.ctaDiscover")}</Button>
            </div>
          </div>
          <div className="home-hero__visual">
            <CoverImage src="/images/hero.svg" className="home-hero__frame" priority />
            {impact.data?.beneficiaries > 0 && (
              <div className="home-hero__float">
                <span className="pub-feature__icon"><Users aria-hidden="true" /></span>
                <span>
                  <strong>{formatNumber(impact.data.beneficiaries)}</strong>
                  personnes accompagnées vers l’autonomie
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {!impact.error && <ImpactBand impact={impact.data} loading={impact.loading} />}

      {failed.length > 0 && (
        <div className="container section--tight">
          <ErrorState
            title="Certaines informations n’ont pas pu être chargées"
            message={getErrorMessage(failed[0].error)}
            onRetry={retry}
          />
        </div>
      )}

      <section className="section" aria-labelledby="home-approach-title">
        <div className="container">
          <div className="section-head section-head--center">
            <span className="eyebrow">Notre approche</span>
            <h2 id="home-approach-title">Donner les moyens d’avancer, pas seulement de l’aide</h2>
            <p>Trois leviers complémentaires, pensés avec les communautés, pour des changements qui durent au-delà de nos programmes.</p>
          </div>
          <div className="grid grid--3 home-approach">
            {APPROACH.map(({ icon: Icon, title, text, accent }) => (
              <Card key={title} className={`pub-feature${accent ? " pub-feature--accent" : ""}`}>
                <span className="pub-feature__icon"><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {(projects.loading || campaigns.length > 0) && (
        <section className="section section--alt" aria-labelledby="home-campaigns-title">
          <div className="container">
            <div className="pub-head-row">
              <div className="section-head">
                <span className="eyebrow">Campagnes en cours</span>
                <h2 id="home-campaigns-title">Soutenez un projet précis</h2>
                <p>Votre don est affecté au projet de votre choix. Suivez en toute transparence l’avancement de chaque collecte.</p>
              </div>
              <Button href="/projets" variant="secondary" iconRight={ArrowRight}>Tous nos projets</Button>
            </div>
            {projects.loading ? (
              <CardsSkeleton />
            ) : (
              <div className="grid grid--3">
                {campaigns.map((project) => <ProjectCard key={project.id} project={project} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="section" aria-labelledby="home-quotes-title">
          <div className="container">
            <div className="section-head section-head--center">
              <span className="eyebrow">Témoignages</span>
              <h2 id="home-quotes-title">Ils et elles racontent leur parcours</h2>
            </div>
            <div className="grid grid--3">
              {quotes.map((quote) => (
                <Card key={quote.id} as="figure" className="home-quote">
                  <Quote className="home-quote__mark" aria-hidden="true" />
                  <blockquote>« {quote.content} »</blockquote>
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

      {(news.loading || latestNews.length > 0) && (
        <section className={`section${quotes.length > 0 ? " section--alt" : ""}`} aria-labelledby="home-news-title">
          <div className="container">
            <div className="pub-head-row">
              <div className="section-head">
                <span className="eyebrow">Actualités</span>
                <h2 id="home-news-title">Les dernières nouvelles du terrain</h2>
              </div>
              <Button href="/actualites" variant="secondary" iconRight={ArrowRight}>Toutes les actualités</Button>
            </div>
            {news.loading ? (
              <CardsSkeleton />
            ) : (
              <div className="grid grid--3">
                {latestNews.map((item) => <NewsCard key={item.id} item={item} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {(events.loading || nextEvents.length > 0) && (
        <section className="section" aria-labelledby="home-events-title">
          <div className="container">
            <div className="pub-head-row">
              <div className="section-head">
                <span className="eyebrow">Agenda</span>
                <h2 id="home-events-title">Prochains rendez-vous</h2>
                <p>Ateliers, journées de collecte, visites de terrain : venez nous rencontrer.</p>
              </div>
              <Button href="/evenements" variant="secondary" iconRight={ArrowRight}>Tout l’agenda</Button>
            </div>
            {events.loading ? (
              <div className="skeleton" style={{ height: 260 }} aria-busy="true" aria-label="Chargement de l’agenda" />
            ) : (
              <div className="pub-events pub-events--compact">
                {nextEvents.map((event) => <EventCard key={event.id} event={event} compact />)}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="section section--tight" aria-labelledby="home-cta-title">
        <div className="container">
          <div className="home-cta">
            <div>
              <h2 id="home-cta-title">{t("home.ctaTitle")}</h2>
              <p>{t("home.ctaText")}</p>
            </div>
            <div className="home-cta__actions">
              <Button href="/don" variant="accent" size="lg" icon={Heart}>{t("home.ctaDonate")}</Button>
              <Button href="/rejoindre" variant="light" size="lg">{t("home.ctaJoin")}</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
