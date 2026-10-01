"use client";

import "../../styles/public.css";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, CalendarDays, Newspaper } from "lucide-react";
import { Button, EmptyState, ErrorState, LoadingState } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatDate } from "../../utils/format";
import { BackLink, CoverImage } from "./components";
import { isNotFound, paragraphs } from "./components/helpers";

export default function NewsDetailView() {
  const { id } = useParams();
  const { data: item, loading, error, reload } = useAsync(() => publicApi.getContent("news", id), [id]);
  const projectId = item?.project_id;
  // Projet lie : facultatif, on ignore silencieusement s'il n'est plus publie.
  const project = useAsync(() => publicApi.getContent("projects", projectId), [projectId], { enabled: Boolean(projectId) });

  if (loading) return <div className="container section"><LoadingState label="Chargement de l’article…" /></div>;

  if (error) {
    return (
      <div className="container section">
        {isNotFound(error) ? (
          <EmptyState
            icon={Newspaper}
            title="Actualité introuvable"
            description="Cet article n’existe pas ou n’est plus publié."
            action={<Button href="/actualites">Retour aux actualités</Button>}
          />
        ) : (
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        )}
      </div>
    );
  }

  const linked = projectId ? project.data : null;

  return (
    <section className="section section--tight">
      <article className="container pub-article">
        <BackLink href="/actualites">Toutes les actualités</BackLink>
        <div className="pub-article__meta">
          <span><CalendarDays aria-hidden="true" /> <time dateTime={item.created_at}>{formatDate(item.created_at)}</time></span>
          {linked && <span>Projet : <Link href={`/projets/${linked.id}`}>{linked.title}</Link></span>}
        </div>
        <h1>{item.title}</h1>
        {item.summary && <p className="lead">{item.summary}</p>}
        <CoverImage src={item.image_url} priority />
        <div className="prose">
          {paragraphs(item.content).map((text, index) => <p key={index}>{text}</p>)}
        </div>

        {linked && (
          <Link href={`/projets/${linked.id}`} className="card card--hover pub-linked">
            <CoverImage src={linked.image_url} />
            <span className="pub-linked__body">
              <span className="eyebrow" style={{ margin: 0 }}>Projet lié</span>
              <strong>{linked.title}</strong>
              {linked.summary && <span className="muted">{linked.summary}</span>}
              <span className="pub-card__more">Découvrir le projet <ArrowRight aria-hidden="true" /></span>
            </span>
          </Link>
        )}
      </article>
    </section>
  );
}
