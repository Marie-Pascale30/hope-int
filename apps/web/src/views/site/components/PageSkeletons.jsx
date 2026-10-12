"use client";

// Squelettes des pages publiques (fichiers loading.jsx) : memes gabarits que les pages chargees
// (bandeau, grille de cartes, agenda, fiche detaillee). Blocs decoratifs ; la region annonce
// le chargement aux lecteurs d'ecran (SkeletonRegion).
import "@/src/styles/public.css";
import { useTranslations } from "next-intl";
import { SkeletonLine, SkeletonRegion } from "@/src/components/ui";

function HeroSkeleton() {
  return (
    <section className="pub-hero">
      <div className="container">
        <SkeletonLine width="120px" height={12} />
        <SkeletonLine width="min(420px, 80%)" height={40} className="skeleton-line--gap" />
        <SkeletonLine width="min(560px, 95%)" height={14} className="skeleton-line--gap" />
      </div>
    </section>
  );
}

function CardSkeleton() {
  return (
    <div className="card pub-skeleton-card">
      <div className="skeleton pub-skeleton-card__media" />
      <div className="pub-skeleton-card__body">
        <SkeletonLine width="35%" />
        <SkeletonLine width="85%" height={22} />
        <SkeletonLine width="100%" />
        <SkeletonLine width="70%" />
      </div>
    </div>
  );
}

function EventRowSkeleton() {
  return (
    <div className="card pub-event pub-skeleton-event">
      <span className="skeleton pub-skeleton-event__date" />
      <div className="pub-skeleton-card__body pub-skeleton-event__body">
        <SkeletonLine width="60%" height={20} />
        <SkeletonLine width="40%" />
        <SkeletonLine width="90%" />
      </div>
    </div>
  );
}

// variant : "cards" (projets, actualites) | "events" (agenda)
export function ListPageSkeleton({ variant = "cards", count = 6 }) {
  const t = useTranslations("common");
  return (
    <SkeletonRegion label={t("loading")}>
      <HeroSkeleton />
      <section className="section section--tight">
        <div className="container">
          {variant === "events" ? (
            <div className="stack">
              {Array.from({ length: Math.min(count, 4) }, (_, index) => <EventRowSkeleton key={index} />)}
            </div>
          ) : (
            <div className="grid grid--3">
              {Array.from({ length: count }, (_, index) => <CardSkeleton key={index} />)}
            </div>
          )}
        </div>
      </section>
    </SkeletonRegion>
  );
}

// variant : "aside" (projet, evenement : colonne d'action) | "article" (actualite)
export function DetailPageSkeleton({ variant = "aside" }) {
  const t = useTranslations("common");
  if (variant === "article") {
    return (
      <SkeletonRegion label={t("loading")}>
        <section className="section section--tight">
          <div className="container pub-article">
            <SkeletonLine width="140px" />
            <SkeletonLine width="90%" height={40} className="skeleton-line--gap" />
            <SkeletonLine width="70%" height={16} className="skeleton-line--gap" />
            <div className="skeleton pub-cover pub-skeleton-cover" />
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonLine key={index} width={index % 3 === 2 ? "65%" : "100%"} className="skeleton-line--gap" />
            ))}
          </div>
        </section>
      </SkeletonRegion>
    );
  }
  return (
    <SkeletonRegion label={t("loading")}>
      <div className="container pub-detail-head">
        <SkeletonLine width="140px" />
        <div className="skeleton pub-cover pub-cover--wide pub-skeleton-cover" />
        <SkeletonLine width="min(520px, 90%)" height={40} className="skeleton-line--gap" />
        <SkeletonLine width="min(640px, 95%)" height={16} className="skeleton-line--gap" />
      </div>
      <section className="section section--tight">
        <div className="container pub-detail-layout">
          <div>
            <SkeletonLine width="30%" height={24} />
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonLine key={index} width={index % 3 === 2 ? "60%" : "100%"} className="skeleton-line--gap" />
            ))}
          </div>
          <div className="card card--pad">
            <SkeletonLine width="50%" height={18} />
            <SkeletonLine width="100%" height={10} className="skeleton-line--gap" />
            <SkeletonLine width="100%" height={44} className="skeleton-line--gap" />
          </div>
        </div>
      </section>
    </SkeletonRegion>
  );
}
