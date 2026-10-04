// Composants propres au site public (cartes, visuels, blocs de date).
// Sans "use client" : rendus cote serveur par les pages, ou cote client dans les ilots interactifs.
import { ArrowLeft, ArrowRight, CalendarDays, Clock, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, ProgressBar, StatusBadge } from "../../../components/ui";
import { useFormat } from "../../../i18n/format";
import { Link, useLocalePath } from "../../../i18n/navigation";
import { truncate } from "../../../utils/format";
import { TONES } from "../../../utils/labels";
import CoverImage, { IMAGE_SIZES } from "./CoverImage";
import RegisteredBadge from "./RegisteredBadge";
import { Empty, LinkButton, Stat } from "./ui";
import { campaignPercent, cx, euros, eventTimeRange, hasCampaign, spotsStatus } from "./helpers";

export { CoverImage, Empty, IMAGE_SIZES, LinkButton, RegisteredBadge, Stat };

// Statut de projet traduit ({ label, tone } pour StatusBadge).
export function useProjectStatus() {
  const t = useTranslations("site.status");
  return (status) => (status in TONES.projectStatus ? { label: t(status), tone: TONES.projectStatus[status] } : null);
}

// ---------- En-tetes ----------

export function PublicHero({ eyebrow, title, lead, children }) {
  return (
    <section className="pub-hero">
      <div className="container">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {children && <div className="pub-hero__extra">{children}</div>}
      </div>
    </section>
  );
}

export function BackLink({ href, children }) {
  return (
    <Link href={href} className="pub-back">
      <ArrowLeft aria-hidden="true" /> {children}
    </Link>
  );
}

// ---------- Squelettes ----------

export function CardsSkeleton({ count = 3 }) {
  const t = useTranslations("common");
  return (
    <div className="grid grid--3" aria-busy="true" aria-label={t("loading")}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card pub-skeleton-card">
          <div className="skeleton pub-skeleton-card__media" />
          <div className="pub-skeleton-card__body">
            <div className="skeleton" style={{ height: 12, width: "35%" }} />
            <div className="skeleton" style={{ height: 22, width: "85%" }} />
            <div className="skeleton" style={{ height: 12, width: "100%" }} />
            <div className="skeleton" style={{ height: 12, width: "70%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Campagne ----------

export function CampaignProgress({ project, large }) {
  const t = useTranslations("site.campaign");
  const f = useFormat();
  const percent = campaignPercent(project);
  const donors = t("donors", { count: Number(project.donors_count) || 0 });
  return (
    <div className={cx("pub-campaign", large && "pub-campaign--large")}>
      <p className="pub-campaign__figures">
        {t.rich("raised", {
          raised: euros(f, project.raised_eur),
          goal: euros(f, project.goal_amount),
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
        {!large && <> · {donors}</>}
      </p>
      <ProgressBar value={percent} accent label={t("progressLabel", { percent })} />
      <div className="progress-meta">
        <span className="pub-campaign__pct">{t("percent", { percent })}</span>
        {large && <span>{donors}</span>}
      </div>
    </div>
  );
}

// ---------- Cartes ----------

export function ProjectCard({ project }) {
  const t = useTranslations("site.cards");
  const lp = useLocalePath();
  const statusOf = useProjectStatus();
  const campaign = hasCampaign(project);
  return (
    <article className="card pub-card card--hover">
      <div className="pub-card__badge">
        <StatusBadge status={statusOf(project.status)} />
      </div>
      <CoverImage src={project.image_url} />
      <div className="pub-card__body">
        {project.region && (
          <div className="pub-card__meta">
            <span><MapPin aria-hidden="true" /> {project.region}</span>
          </div>
        )}
        <h3 className="pub-card__title">
          <Link href={`/projets/${project.id}`}>{project.title}</Link>
        </h3>
        {project.summary && <p className="pub-card__text">{project.summary}</p>}
        {campaign && <CampaignProgress project={project} />}
        <div className="pub-card__foot">
          <span className="pub-card__more" aria-hidden="true">
            {t("discover")} <ArrowRight />
          </span>
          {campaign && (
            <LinkButton href={lp(`/don?projet=${project.id}`)} variant="accent" size="sm" aria-label={t("supportProject", { title: project.title })}>
              {t("support")}
            </LinkButton>
          )}
        </div>
      </div>
    </article>
  );
}

export function NewsCard({ item, featured }) {
  const t = useTranslations("site.cards");
  const f = useFormat();
  return (
    <article className={cx("card pub-card card--hover", featured && "pub-card--featured")}>
      <CoverImage src={item.image_url} priority={featured} sizes={featured ? "featured" : "card"} />
      <div className="pub-card__body">
        <div className="pub-card__meta">
          <span><CalendarDays aria-hidden="true" /> <time dateTime={item.created_at}>{f.date(item.created_at)}</time></span>
          {featured && <Badge tone="accent" plain>{t("featured")}</Badge>}
        </div>
        <h3 className="pub-card__title">
          <Link href={`/actualites/${item.id}`}>{item.title}</Link>
        </h3>
        <p className="pub-card__text">{item.summary || truncate(item.content, featured ? 220 : 140)}</p>
        <div className="pub-card__foot">
          <span className="pub-card__more" aria-hidden="true">
            {t("readArticle")} <ArrowRight />
          </span>
        </div>
      </div>
    </article>
  );
}

export function EventDate({ value }) {
  const f = useFormat();
  return (
    <div className="pub-date" aria-hidden="true">
      <span className="pub-date__month">{f.date(value, { month: "short" }).replace(".", "")}</span>
      <span className="pub-date__day">{f.date(value, { day: "2-digit" })}</span>
      <span className="pub-date__weekday">{f.date(value, { weekday: "short" })}</span>
    </div>
  );
}

export function EventCard({ event, compact }) {
  const tSpots = useTranslations("site.spots");
  const f = useFormat();
  const spots = spotsStatus(event, tSpots);
  return (
    <article className="card pub-event card--hover">
      <EventDate value={event.start_at} />
      <div className="pub-event__main">
        <h3 className="pub-event__title">
          <Link href={`/evenements/${event.id}`}>
            <span className="visually-hidden">{f.date(event.start_at)} : </span>
            {event.title}
          </Link>
        </h3>
        <div className="pub-card__meta">
          <span><Clock aria-hidden="true" /> {eventTimeRange(event, f)}</span>
          {event.location && <span><MapPin aria-hidden="true" /> {event.location}</span>}
        </div>
        {!compact && event.description && <p className="pub-event__desc">{truncate(event.description, 150)}</p>}
        {compact && (
          <div className="chip-list">
            <Badge tone={spots.tone}>{spots.label}</Badge>
            <RegisteredBadge eventId={event.id} />
          </div>
        )}
      </div>
      {!compact && (
        <div className="pub-event__side">
          {event.region && <Badge plain>{event.region}</Badge>}
          <Badge tone={spots.tone}>{spots.label}</Badge>
          <RegisteredBadge eventId={event.id} plain />
        </div>
      )}
    </article>
  );
}
