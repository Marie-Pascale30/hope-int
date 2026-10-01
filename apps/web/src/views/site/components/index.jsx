"use client";

// Composants propres au site public (cartes, visuels, blocs de date).
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock, MapPin } from "lucide-react";
import { Badge, Button, ProgressBar, StatusBadge } from "../../../components/ui";
import { formatDate, truncate } from "../../../utils/format";
import { PROJECT_STATUS, statusOf } from "../../../utils/labels";
import {
  PLACEHOLDER,
  campaignPercent,
  cx,
  euros,
  eventTimeRange,
  hasCampaign,
  imageSrc,
  plural,
  spotsStatus,
} from "./helpers";

// ---------- Visuels ----------

// variant : undefined (3/2) | "wide" (21/9) | "square"
export function CoverImage({ src, alt = "", variant, className, priority }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const url = failedSrc === src ? PLACEHOLDER : imageSrc(src);
  return (
    <div className={cx("cover pub-cover", variant && `pub-cover--${variant}`, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
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
  return (
    <div className="grid grid--3" aria-busy="true" aria-label="Chargement">
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
  const percent = campaignPercent(project);
  const donors = plural(project.donors_count, "donateur");
  return (
    <div className={cx("pub-campaign", large && "pub-campaign--large")}>
      <p className="pub-campaign__figures">
        <strong>{euros(project.raised_eur)}</strong> collectés sur {euros(project.goal_amount)}
        {!large && <> · {donors}</>}
      </p>
      <ProgressBar value={percent} accent label={`Collecte : ${percent} % de l'objectif atteint`} />
      <div className="progress-meta">
        <span className="pub-campaign__pct">{percent} % de l&apos;objectif</span>
        {large && <span>{donors}</span>}
      </div>
    </div>
  );
}

// ---------- Cartes ----------

export function ProjectCard({ project }) {
  const campaign = hasCampaign(project);
  return (
    <article className="card pub-card card--hover">
      <div className="pub-card__badge">
        <StatusBadge status={statusOf(PROJECT_STATUS, project.status)} />
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
            Découvrir <ArrowRight />
          </span>
          {campaign && (
            <Button href={`/don?projet=${project.id}`} variant="accent" size="sm" aria-label={`Soutenir le projet ${project.title}`}>
              Soutenir
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function NewsCard({ item, featured }) {
  return (
    <article className={cx("card pub-card card--hover", featured && "pub-card--featured")}>
      <CoverImage src={item.image_url} priority={featured} />
      <div className="pub-card__body">
        <div className="pub-card__meta">
          <span><CalendarDays aria-hidden="true" /> {formatDate(item.created_at)}</span>
          {featured && <Badge tone="accent" plain>À la une</Badge>}
        </div>
        <h3 className="pub-card__title">
          <Link href={`/actualites/${item.id}`}>{item.title}</Link>
        </h3>
        <p className="pub-card__text">{item.summary || truncate(item.content, featured ? 220 : 140)}</p>
        <div className="pub-card__foot">
          <span className="pub-card__more" aria-hidden="true">
            Lire l&apos;article <ArrowRight />
          </span>
        </div>
      </div>
    </article>
  );
}

export function EventDate({ value }) {
  return (
    <div className="pub-date" aria-hidden="true">
      <span className="pub-date__month">{formatDate(value, { month: "short" }).replace(".", "")}</span>
      <span className="pub-date__day">{formatDate(value, { day: "2-digit" })}</span>
      <span className="pub-date__weekday">{formatDate(value, { weekday: "short" })}</span>
    </div>
  );
}

export function EventCard({ event, compact }) {
  const spots = spotsStatus(event);
  return (
    <article className="card pub-event card--hover">
      <EventDate value={event.start_at} />
      <div className="pub-event__main">
        <h3 className="pub-event__title">
          <Link href={`/evenements/${event.id}`}>
            <span className="visually-hidden">{formatDate(event.start_at)} : </span>
            {event.title}
          </Link>
        </h3>
        <div className="pub-card__meta">
          <span><Clock aria-hidden="true" /> {eventTimeRange(event)}</span>
          {event.location && <span><MapPin aria-hidden="true" /> {event.location}</span>}
        </div>
        {!compact && event.description && <p className="pub-event__desc">{truncate(event.description, 150)}</p>}
        {compact && (
          <div className="chip-list">
            <Badge tone={spots.tone}>{spots.label}</Badge>
            {event.is_registered && <Badge tone="success">Vous êtes inscrit(e)</Badge>}
          </div>
        )}
      </div>
      {!compact && (
        <div className="pub-event__side">
          {event.region && <Badge plain>{event.region}</Badge>}
          <Badge tone={spots.tone}>{spots.label}</Badge>
          {event.is_registered && (
            <Badge tone="success" plain>
              <CheckCircle2 size={14} aria-hidden="true" /> Vous êtes inscrit(e)
            </Badge>
          )}
        </div>
      )}
    </article>
  );
}
