// Accueil (composant serveur) : les donnees sont chargees par app/[locale]/page.jsx.
// Une source en erreur n'empeche pas l'affichage des autres (contenu partiel + message).
import "../../styles/public.css";
import { ArrowRight, Droplets, GraduationCap, HandHeart, Heart, Quote, Stethoscope, Users } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { hl } from "../../components/motion/hl";
import Marquee from "../../components/motion/Marquee";
import NumberTicker from "../../components/motion/NumberTicker";
import PageBanner from "../../components/site/PageBanner";
import PhotoGallery from "../../components/site/PhotoGallery";
import { photoUrl } from "@hope/shared/photos";
import WordRotate from "../../components/motion/WordRotate";
import { Avatar, Button, Card } from "../../components/ui";
import { useFormat } from "../../i18n/format";
import { useLocalePath } from "../../i18n/navigation";
import { CoverImage, EventCard, NewsCard, ProjectCard } from "./components";
import LoadError from "./components/LoadError";
import ImpactCalculator from "./components/ImpactCalculator";
import RegionMapSection from "./components/RegionMapSection";
import { DataSaverToggle } from "../../components/eco/DataSaver";
import { hasCampaign } from "./components/helpers";
import { PARTNERS } from "./partners";
import { HOME_PHOTOS, galleryItems, selectPhotos } from "./gallery";

// Domaines d'action de l'association (guide de bienvenue) ; detail sur la page "Qui sommes-nous".
const APPROACH = [
  { icon: GraduationCap, key: "education", accent: true },
  { icon: Stethoscope, key: "health" },
  { icon: HandHeart, key: "social" },
  { icon: Droplets, key: "community" },
];

function ImpactBand({ impact }) {
  const t = useTranslations("site.home.impact");
  // Les chiffres defilent jusqu'a leur valeur a l'arrivee du bandeau a l'ecran.
  const items = [
    { value: impact.beneficiaries, label: t("beneficiaries") },
    { value: impact.trainees, label: t("trainees") },
    { value: impact.creditsGranted, label: t("credits") },
    { value: impact.regionsCovered, label: t("regions") },
    { value: impact.totalRaisedEur, kind: "eur", label: t("raised") },
    { value: impact.donors, label: t("donors") },
  ];
  return (
    <section className="home-impact" aria-labelledby="home-impact-title" data-header-overlay>
      <div className="container">
        <div className="home-impact__head">
          <div>
            <span className="eyebrow">{t("eyebrow")}</span>
            <h2 id="home-impact-title">{t.rich("title", { hl })}</h2>
          </div>
          <p>{t("text")}</p>
        </div>
        <ul className="home-impact__grid">
          {items.map((item) => (
            <li key={item.label}>
              <NumberTicker value={item.value} kind={item.kind} className="home-impact__value" />
              <span className="home-impact__label">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// "En images" : une selection de photos du livret, qui s'ouvrent dans la visionneuse, et le lien
// vers la galerie complete.
function GallerySection() {
  const t = useTranslations("site.gallery");
  const f = useFormat();
  const lp = useLocalePath();
  return (
    <section className="section" aria-labelledby="home-gallery-title">
      <div className="container">
        <div className="pub-head-row">
          <div className="section-head">
            <span className="eyebrow">{t("home.eyebrow")}</span>
            <h2 id="home-gallery-title">{t.rich("home.title", { hl })}</h2>
            <p>{t("home.text")}</p>
          </div>
          <Button href={lp("/galerie")} variant="secondary" iconRight={ArrowRight}>{t("home.all")}</Button>
        </div>
        <PhotoGallery items={galleryItems(t, f, selectPhotos(...HOME_PHOTOS))} variant="mosaic" label={t("home.label")} />
      </div>
    </section>
  );
}

function CalculatorSection({ xafPerEur }) {
  const t = useTranslations("transparency.calculator");
  return (
    <section className="section section--alt" aria-labelledby="home-calculator-title">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h2 id="home-calculator-title">{t("title")}</h2>
          <p>{t("text")}</p>
        </div>
        <ImpactCalculator xafPerEur={xafPerEur} />
      </div>
    </section>
  );
}

export default function HomeView({ impact, projects, testimonials, news, events, regions, xafPerEur, failed }) {
  const t = useTranslations("site.home");
  const tEco = useTranslations("transparency.eco");
  const f = useFormat();
  const lp = useLocalePath();

  const campaigns = (projects || []).filter(hasCampaign).slice(0, 3);
  const quotes = testimonials || [];
  const latestNews = (news || []).slice(0, 3);
  const nextEvents = (events || []).slice(0, 3);

  return (
    <>
      <PageBanner name="home" />

      <section className="home-hero">
        <div className="container home-hero__grid">
          <div>
            <span className="eyebrow">{t("eyebrow")}</span>
            {/* Titre complet pour les lecteurs d'ecran ; a l'ecran, le dernier mot change (enfants, meres seules...). */}
            <h1>
              <span className="visually-hidden">{t("title")}</span>
              <span aria-hidden="true">
                {t("titleLead")} <WordRotate words={t.raw("titleWords")} className="home-hero__rotate" />
              </span>
            </h1>
            <p className="lead">{t("lead")}</p>
            <div className="home-hero__actions">
              <Button href={lp("/don")} variant="accent" size="lg" icon={Heart}>{t("ctaDonate")}</Button>
              <Button href={lp("/projets")} variant="secondary" size="lg" iconRight={ArrowRight}>{t("ctaDiscover")}</Button>
            </div>
          </div>
          <div className="home-hero__visual">
            <CoverImage src={photoUrl("p02_01")} alt={t("heroAlt")} className="home-hero__frame" priority sizes="hero" />
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

      {/* Domaines d'action : titre fixe a gauche, les quatre cartes s'empilent au defilement (Stacking Cards). */}
      <section className="section" aria-labelledby="home-approach-title">
        <div className="container home-approach-layout">
          <div className="section-head home-approach__head">
            <span className="eyebrow">{t("approach.eyebrow")}</span>
            <h2 id="home-approach-title">{t.rich("approach.title", { hl })}</h2>
            <p>{t("approach.text")}</p>
            <Button href={lp("/a-propos")} variant="secondary" iconRight={ArrowRight}>{t("ctaAbout")}</Button>
          </div>
          <ol className="home-approach stack-cards">
            {APPROACH.map(({ icon: Icon, key, accent }, index) => (
              <li key={key} className="stack-cards__step" style={{ "--step": index }}>
                <Card className={`pub-feature${accent ? " pub-feature--accent" : ""}`}>
                  <span className="pub-feature__icon"><Icon aria-hidden="true" /></span>
                  <h3>{t(`approach.${key}.title`)}</h3>
                  <p>{t(`approach.${key}.text`)}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CalculatorSection xafPerEur={xafPerEur} />

      <GallerySection />

      {campaigns.length > 0 && (
        <section className="section" aria-labelledby="home-campaigns-title">
          <div className="container">
            <div className="pub-head-row">
              <div className="section-head">
                <span className="eyebrow">{t("campaigns.eyebrow")}</span>
                <h2 id="home-campaigns-title">{t("campaigns.title")}</h2>
                <p>{t("campaigns.text")}</p>
              </div>
              <Button href={lp("/projets")} variant="secondary" iconRight={ArrowRight}>{t("campaigns.all")}</Button>
            </div>
            <div className="grid grid--3">
              {campaigns.map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
          </div>
        </section>
      )}

      <RegionMapSection regions={regions} alt />

      {quotes.length > 0 && (
        <section className="section" aria-labelledby="home-quotes-title">
          <div className="container">
            <div className="section-head section-head--center">
              <span className="eyebrow">{t("quotes.eyebrow")}</span>
              <h2 id="home-quotes-title">{t.rich("quotes.title", { hl })}</h2>
            </div>
          </div>
          {/* Bande defilante pleine largeur, pause au survol */}
          <Marquee
            items={quotes}
            getKey={(quote) => quote.id}
            minItems={6}
            duration={Math.max(40, quotes.length * 14)}
            className="home-quotes"
            renderItem={(quote) => (
              <Card as="figure" className="home-quote">
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
            )}
          />
        </section>
      )}

      {PARTNERS.length > 0 && (
        <section className="section section--tight" aria-labelledby="home-partners-title">
          <div className="container">
            <div className="section-head section-head--center">
              <span className="eyebrow">{t("partners.eyebrow")}</span>
              <h2 id="home-partners-title">{t("partners.title")}</h2>
            </div>
          </div>
          <Marquee
            items={PARTNERS}
            getKey={(partner) => partner.name}
            minItems={8}
            duration={35}
            className="home-partners"
            renderItem={(partner) => {
              const logo = <Image src={partner.logo} alt={partner.name} width={160} height={48} />;
              return partner.url ? <a href={partner.url} target="_blank" rel="noopener noreferrer">{logo}</a> : logo;
            }}
          />
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
              <Button href={lp("/actualites")} variant="secondary" iconRight={ArrowRight}>{t("news.all")}</Button>
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
              <Button href={lp("/evenements")} variant="secondary" iconRight={ArrowRight}>{t("events.all")}</Button>
            </div>
            <div className="pub-events pub-events--compact">
              {nextEvents.map((event) => <EventCard key={event.id} event={event} compact />)}
            </div>
          </div>
        </section>
      )}

      <section className="section section--tight" aria-labelledby="home-cta-title">
        <div className="container">
          {/* shine-border : reflet dore qui fait le tour du cadre (Shine Border) */}
          <div className="home-cta shine-border">
            <div>
              <h2 id="home-cta-title">{t.rich("ctaTitle", { hl })}</h2>
              <p>{t("ctaText")}</p>
            </div>
            <div className="home-cta__actions">
              <Button href={lp("/don")} variant="accent" size="lg" icon={Heart}>{t("ctaDonate")}</Button>
              <Button href={lp("/rejoindre")} variant="light" size="lg">{t("ctaJoin")}</Button>
            </div>
          </div>
          <p className="eco-note">
            <span>{tEco("homeNote")}</span>
            <DataSaverToggle />
          </p>
        </div>
      </section>
    </>
  );
}
