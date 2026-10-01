"use client";

import "../../styles/public.css";
import { useParams } from "next/navigation";
import { CalendarCheck, CalendarDays, FolderSearch, GraduationCap, HandCoins, Heart, MapPin, Users, Wallet } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, LoadingState, StatCard, StatusBadge } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatDate, formatNumber } from "../../utils/format";
import { PROJECT_STATUS, statusOf } from "../../utils/labels";
import { BackLink, CampaignProgress, CoverImage, NewsCard } from "./components";
import { euros, hasCampaign, isNotFound, paragraphs } from "./components/helpers";

function CampaignAside({ project }) {
  if (project.status === "termine") {
    return (
      <Card>
        <h2 className="pub-aside__title">Projet terminé</h2>
        <Alert tone="success" title="Merci pour votre soutien">
          Ce projet est terminé et poursuit sa route de manière autonome. Merci à toutes celles et ceux qui l’ont rendu possible !
        </Alert>
        <p className="muted" style={{ margin: "14px 0 0" }}>Soutenez nos autres actions en cours pour que d’autres familles en bénéficient.</p>
        <Button href="/projets" block>Voir les projets en cours</Button>
      </Card>
    );
  }
  if (!hasCampaign(project)) {
    return (
      <Card>
        <h2 className="pub-aside__title">Soutenir ce projet</h2>
        <p className="muted">Ce projet n’a pas de collecte dédiée : il est financé par les dons généraux faits à HOPE International.</p>
        <Button href="/don" variant="accent" icon={Heart} block>Faire un don</Button>
      </Card>
    );
  }
  return (
    <Card>
      <span className="eyebrow">Campagne de collecte</span>
      <CampaignProgress project={project} large />
      <Button href={`/don?projet=${project.id}`} variant="accent" size="lg" icon={Heart} block>
        Faire un don pour ce projet
      </Button>
      <p className="pub-aside__note">Votre don est affecté à ce projet. Un reçu vous est délivré dès la confirmation du paiement.</p>
    </Card>
  );
}

export default function ProjectDetailView() {
  const { id } = useParams();
  const { data: project, loading, error, reload } = useAsync(() => publicApi.getContent("projects", id), [id]);
  const news = useAsync(() => publicApi.listContent("news"), []);

  if (loading) return <div className="container section"><LoadingState label="Chargement du projet…" /></div>;

  if (error) {
    return (
      <div className="container section">
        {isNotFound(error) ? (
          <EmptyState
            icon={FolderSearch}
            title="Projet introuvable"
            description="Ce projet n’existe pas ou n’est plus publié. Découvrez nos autres actions en cours."
            action={<Button href="/projets">Retour aux projets</Button>}
          />
        ) : (
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        )}
      </div>
    );
  }

  const related = (news.data || []).filter((item) => String(item.project_id) === String(project.id)).slice(0, 3);
  const planned = project.status === "planifie";
  const indicator = (value) => (planned && !Number(value) ? "À venir" : formatNumber(value));

  return (
    <>
      <div className="container pub-detail-head">
        <BackLink href="/projets">Tous les projets</BackLink>
        <CoverImage src={project.image_url} variant="wide" priority />
        <div className="pub-detail-title">
          <div className="chip-list" style={{ marginBottom: 14 }}>
            <StatusBadge status={statusOf(PROJECT_STATUS, project.status)} />
            {project.region && (
              <Badge plain><MapPin size={14} aria-hidden="true" /> {project.region}</Badge>
            )}
          </div>
          <h1>{project.title}</h1>
          {project.summary && <p className="lead">{project.summary}</p>}
        </div>
      </div>

      <section className="section section--tight">
        <div className="container pub-detail-layout">
          <div>
            <div className="pub-block">
              <h2>Le projet</h2>
              <div className="prose pub-prose">
                {paragraphs(project.description).map((text, index) => <p key={index}>{text}</p>)}
              </div>
            </div>

            <div className="pub-block">
              <h2>Impact</h2>
              <div className="pub-indicators">
                <StatCard label="Bénéficiaires" value={indicator(project.beneficiaries)} icon={Users} />
                <StatCard label="Personnes formées" value={indicator(project.trainees)} icon={GraduationCap} tone="info" />
                <StatCard label="Microcrédits accordés" value={indicator(project.credits_granted)} icon={HandCoins} tone="accent" />
              </div>
              <dl className="pub-facts">
                <div>
                  <dt><CalendarDays aria-hidden="true" /> Début</dt>
                  <dd>{project.start_date ? formatDate(project.start_date) : "À définir"}</dd>
                </div>
                <div>
                  <dt><CalendarCheck aria-hidden="true" /> Fin prévue</dt>
                  <dd>{project.end_date ? formatDate(project.end_date) : "Programme sans date de fin"}</dd>
                </div>
                {Number(project.budget) > 0 && (
                  <div>
                    <dt><Wallet aria-hidden="true" /> Budget total</dt>
                    <dd>{euros(project.budget)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <aside className="pub-aside" aria-label="Soutenir ce projet">
            <CampaignAside project={project} />
          </aside>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section section--alt" aria-labelledby="project-news-title">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">Sur le terrain</span>
              <h2 id="project-news-title">Actualités du projet</h2>
            </div>
            <div className="grid grid--3">
              {related.map((item) => <NewsCard key={item.id} item={item} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
