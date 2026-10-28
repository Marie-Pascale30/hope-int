// Page "Qui sommes-nous" (composant serveur, contenu statique) : identite, mission, vision, valeurs,
// devise, actions, parcours depuis 2021, projets a venir, presidence et adhesion.
// Textes : site.about (guide de bienvenue et livret partenaires de l'association). Photos : livret
// partenaires (src/views/site/gallery.js : ABOUT_PHOTOS), chaque etape ouvre ses photos en visionneuse.
import "../../styles/public.css";
import "../../styles/about.css";
import {
  ArrowRight, Building2, Check, Cross, Droplets, GraduationCap, HandCoins, HandHeart, Heart, HeartHandshake,
  Quote, Scale, School, ShieldCheck, Sprout, Stethoscope, Target, Telescope, UserRound, UsersRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { hl } from "../../components/motion/hl";
import PageBanner from "../../components/site/PageBanner";
import PhotoGallery from "../../components/site/PhotoGallery";
import { photoUrl } from "@hope/shared/photos";
import { Button, Card } from "../../components/ui";
import { useFormat } from "../../i18n/format";
import { Link, useLocalePath } from "../../i18n/navigation";
import { PublicHero } from "./components";
import CoverImage from "./components/CoverImage";
import MembershipFees from "./components/MembershipFees";
import { ABOUT_PHOTOS, galleryItems, selectPhotos } from "./gallery";

const VALUES = [
  { key: "faith", icon: Cross, accent: true },
  { key: "equity", icon: Scale },
  { key: "compassion", icon: HeartHandshake },
  { key: "commitment", icon: Sprout },
  { key: "transparency", icon: ShieldCheck },
];

const ACTIONS = [
  { key: "education", icon: GraduationCap, accent: true },
  { key: "health", icon: Stethoscope },
  { key: "social", icon: HandHeart },
  { key: "water", icon: Droplets },
  { key: "community", icon: Building2 },
];

// Parcours par annee ; photos de chaque etape : ABOUT_PHOTOS[cle] (photo de couverture, texte
// alternatif items.<cle>.alt, et vignettes de l'album).
const TIMELINE = [
  { year: 2021, items: [{ key: "balessing" }] },
  {
    year: 2022,
    items: [
      { key: "teachers" },
      { key: "christmas2022" },
      { key: "clothes" },
    ],
  },
  {
    year: 2023,
    items: [
      { key: "women2023" },
      { key: "sickleCell" },
      { key: "dieuMerci" },
      { key: "christmas2023" },
    ],
  },
  {
    year: 2024,
    items: [
      { key: "women2024" },
      { key: "street" },
      { key: "school2024" },
      { key: "december2024" },
    ],
  },
  {
    year: 2025,
    items: [
      { key: "women2025" },
      { key: "school2025" },
      { key: "aids2025" },
    ],
  },
];

const UPCOMING = [
  { key: "academy", icon: School, accent: true },
  { key: "water", icon: Droplets },
  { key: "entrepreneurship", icon: HandCoins },
  { key: "training", icon: UsersRound },
];

// Ancres du sommaire (titre repris de chaque section).
const SECTIONS = [
  { id: "qui-sommes-nous", label: "who.eyebrow" },
  { id: "mission", label: "mission.title" },
  { id: "valeurs", label: "values.eyebrow" },
  { id: "actions", label: "actions.eyebrow" },
  { id: "parcours", label: "timeline.eyebrow" },
  { id: "projets-a-venir", label: "upcoming.eyebrow" },
  { id: "adhesion", label: "membership.eyebrow", root: true },
];

function SectionHead({ id, eyebrow, title, text, center }) {
  return (
    <div className={`section-head${center ? " section-head--center" : ""}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 id={id}>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export default function AboutView() {
  const t = useTranslations("site.about");
  const tSite = useTranslations("site");
  const tGallery = useTranslations("site.gallery");
  const f = useFormat();
  const lp = useLocalePath();
  // Vignettes d'une etape (ou du bloc de presentation) : toutes les photos de ses albums.
  const strip = (key, title) => (
    <PhotoGallery
      items={galleryItems(tGallery, f, selectPhotos(...ABOUT_PHOTOS[key].refs))}
      variant="strip"
      limit={5}
      label={tGallery("stripLabel", { title })}
      className="about-photos"
    />
  );

  return (
    <>
      <PageBanner name="about" />
      <PublicHero eyebrow={t("eyebrow")} title={t.rich("title", { hl })} lead={t("lead")}>
        <blockquote className="about-hero-quote">
          <Quote aria-hidden="true" />
          <p>{t("quote")}</p>
        </blockquote>
      </PublicHero>

      <nav className="container about-toc" aria-label={t("nav")}>
        <ul>
          {SECTIONS.map(({ id, label, root }) => (
            <li key={id}><a href={`#${id}`}>{root ? tSite(label) : t(label)}</a></li>
          ))}
        </ul>
      </nav>

      {/* Qui sommes-nous : texte et engagements, photo de l'equipe et verset fondateur */}
      <section id="qui-sommes-nous" className="section" aria-labelledby="about-who-title">
        <div className="container about-split">
          <div>
            <SectionHead id="about-who-title" eyebrow={t("who.eyebrow")} title={t("who.title")} />
            <p className="lead about-text">{t("who.text")}</p>
            <p className="about-text">{t("who.welcome")}</p>
            <h3 className="about-subtitle">{t("who.commitmentsTitle")}</h3>
            <ul className="about-checklist">
              {t.raw("who.commitments").map((item) => (
                <li key={item}><Check aria-hidden="true" /> <span>{item}</span></li>
              ))}
            </ul>
          </div>
          <div className="about-split__aside">
            <CoverImage src={photoUrl(ABOUT_PHOTOS.who.cover)} alt={t("who.imageAlt")} className="about-photo" sizes="featured" />
            {strip("who", t("who.title"))}
            <figure className="about-verse">
              <figcaption>{t("who.verseIntro")}</figcaption>
              <blockquote>
                <p>{t("who.verse")}</p>
              </blockquote>
              <cite>{t("who.verseRef")}</cite>
            </figure>
          </div>
        </div>
      </section>

      {/* Mission et vision */}
      <section id="mission" className="section section--alt" aria-label={`${t("mission.title")} · ${t("vision.title")}`}>
        <div className="container grid grid--2">
          <Card className="pub-feature about-statement">
            <span className="pub-feature__icon"><Target aria-hidden="true" /></span>
            <h2>{t("mission.title")}</h2>
            <p>{t("mission.text")}</p>
          </Card>
          <Card className="pub-feature pub-feature--accent about-statement">
            <span className="pub-feature__icon"><Telescope aria-hidden="true" /></span>
            <h2>{t("vision.title")}</h2>
            <p>{t("vision.text")}</p>
            <p>{t("vision.education")}</p>
            <p className="about-statement__faith">{t("vision.faith")}</p>
          </Card>
        </div>
      </section>

      {/* Valeurs */}
      <section id="valeurs" className="section" aria-labelledby="about-values-title">
        <div className="container">
          <SectionHead id="about-values-title" eyebrow={t("values.eyebrow")} title={t.rich("values.title", { hl })} center />
          <ul className="about-values">
            {VALUES.map(({ key, icon: Icon, accent }) => (
              <li key={key}>
                <Card className={`pub-feature${accent ? " pub-feature--accent" : ""}`}>
                  <span className="pub-feature__icon"><Icon aria-hidden="true" /></span>
                  <h3>{t(`values.${key}.title`)}</h3>
                  <p>{t(`values.${key}.text`)}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Devise et slogan : bandeau de marque */}
      <section className="about-motto" aria-labelledby="about-motto-title">
        <div className="container about-motto__inner">
          <span className="eyebrow">{t("motto.eyebrow")}</span>
          <h2 id="about-motto-title" className="visually-hidden">{t("motto.mottoLabel")}</h2>
          <p className="about-motto__motto">{t("motto.motto")}</p>
          <p className="about-motto__verse">
            {t("motto.verse")} <cite>({t("motto.verseRef")})</cite>
          </p>
          <div className="about-motto__slogan">
            <span>{t("motto.sloganLabel")}</span>
            <p>{t("motto.slogan")}</p>
          </div>
        </div>
      </section>

      {/* Principales actions : cinq domaines */}
      <section id="actions" className="section" aria-labelledby="about-actions-title">
        <div className="container">
          <SectionHead
            id="about-actions-title"
            eyebrow={t("actions.eyebrow")}
            title={t.rich("actions.title", { hl })}
            text={t("actions.text")}
          />
          <ul className="about-actions">
            {ACTIONS.map(({ key, icon: Icon, accent }) => (
              <li key={key}>
                <Card className={`pub-feature${accent ? " pub-feature--accent" : ""}`}>
                  <span className="pub-feature__icon"><Icon aria-hidden="true" /></span>
                  <h3>{t(`actions.${key}.title`)}</h3>
                  <ul>
                    {t.raw(`actions.${key}.items`).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Parcours 2021-2025 */}
      <section id="parcours" className="section section--alt" aria-labelledby="about-timeline-title">
        <div className="container">
          <SectionHead
            id="about-timeline-title"
            eyebrow={t("timeline.eyebrow")}
            title={t.rich("timeline.title", { hl })}
            text={t("timeline.text")}
          />
          <ol className="about-timeline">
            {TIMELINE.map(({ year, items }) => (
              <li key={year} className="about-timeline__year">
                <h3 className="about-timeline__label">{year}</h3>
                <ul className="about-timeline__items">
                  {items.map(({ key }) => {
                    const cover = ABOUT_PHOTOS[key].cover;
                    return (
                      <li key={key}>
                        <Card pad={false} className={`about-event${cover ? "" : " about-event--text"}`}>
                          {cover && (
                            <CoverImage src={photoUrl(cover)} alt={t(`timeline.items.${key}.alt`)} className="about-event__photo" sizes="card" />
                          )}
                          <div className="about-event__body">
                            <span className="about-event__date">{t(`timeline.items.${key}.date`)}</span>
                            <h4>{t(`timeline.items.${key}.title`)}</h4>
                            <p>{t(`timeline.items.${key}.text`)}</p>
                            {strip(key, t(`timeline.items.${key}.title`))}
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
          <p className="about-gallery-link">
            <Button href={lp("/galerie")} variant="secondary" iconRight={ArrowRight}>{tGallery("about.all")}</Button>
          </p>
        </div>
      </section>

      {/* Projets a venir */}
      <section id="projets-a-venir" className="section" aria-labelledby="about-upcoming-title">
        <div className="container">
          <SectionHead
            id="about-upcoming-title"
            eyebrow={t("upcoming.eyebrow")}
            title={t.rich("upcoming.title", { hl })}
            text={t("upcoming.text")}
          />
          <ul className="about-upcoming">
            {UPCOMING.map(({ key, icon: Icon, accent }) => (
              <li key={key}>
                <Card className={`pub-feature${accent ? " pub-feature--accent" : ""}`}>
                  <span className="pub-feature__icon"><Icon aria-hidden="true" /></span>
                  <h3>{t(`upcoming.${key}.title`)}</h3>
                  <p>{t(`upcoming.${key}.text`)}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Presidence */}
      <section className="section section--tight section--alt" aria-labelledby="about-president-title">
        <div className="container">
          <Card className="about-president">
            <span className="about-president__icon" aria-hidden="true"><UserRound /></span>
            <div>
              <span className="eyebrow">{t("president.eyebrow")}</span>
              <h2 id="about-president-title">{t("president.name")}</h2>
              <p className="about-president__role">{t("president.role")}</p>
              <p>{t("president.text")}</p>
              <Link href="/equipe" className="about-link">
                {t("president.team")} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </div>
      </section>

      <MembershipFees cta />

      {/* Conclusion : "Ensemble, nous faisons vivre HOPE" */}
      <section className="section section--tight" aria-labelledby="about-closing-title">
        <div className="container">
          <div className="home-cta shine-border">
            <div>
              <h2 id="about-closing-title">{t.rich("closing.title", { hl })}</h2>
              <p>{t("closing.text")}</p>
              <p className="about-blessing">{t("closing.blessing")}</p>
            </div>
            <div className="home-cta__actions">
              <Button href={lp("/don")} variant="accent" size="lg" icon={Heart}>{t("closing.donate")}</Button>
              <Button href={lp("/rejoindre")} variant="light" size="lg">{t("closing.join")}</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
