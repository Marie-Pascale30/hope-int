"use client";

import "../../styles/public.css";
import { useMemo, useState } from "react";
import { FolderSearch } from "lucide-react";
import { Button, EmptyState, ErrorState, Tabs } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { CardsSkeleton, ProjectCard, PublicHero } from "./components";
import { plural } from "./components/helpers";

const STATUS_TABS = [
  { value: "all", label: "Tous" },
  { value: "en_cours", label: "En cours" },
  { value: "planifie", label: "Bientôt" },
  { value: "termine", label: "Terminés" },
];

// Ordre d'affichage : en cours, puis a venir, puis termines.
const STATUS_ORDER = { en_cours: 0, planifie: 1, termine: 2 };

export default function ProjectsView() {
  const { data, loading, error, reload } = useAsync(() => publicApi.listContent("projects"), []);
  const [status, setStatus] = useState("all");
  const [region, setRegion] = useState("");

  const projects = useMemo(
    () => [...(data || [])].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)),
    [data]
  );
  const regions = useMemo(() => [...new Set(projects.map((p) => p.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [projects]);
  const byRegion = region ? projects.filter((p) => p.region === region) : projects;
  const visible = status === "all" ? byRegion : byRegion.filter((p) => p.status === status);
  const tabs = STATUS_TABS.map((tab) => ({
    ...tab,
    count: tab.value === "all" ? byRegion.length : byRegion.filter((p) => p.status === tab.value).length,
  }));

  const resetFilters = () => {
    setStatus("all");
    setRegion("");
  };

  return (
    <>
      <PublicHero
        eyebrow="Nos projets"
        title="Des projets ancrés dans les communautés"
        lead="Microcrédit, formation, agriculture, accès à l’eau, épargne santé : découvrez nos actions dans les régions du Cameroun et choisissez celle que vous souhaitez soutenir."
      />
      <section className="section section--tight">
        <div className="container">
          {loading ? (
            <CardsSkeleton count={6} />
          ) : error ? (
            <ErrorState message={getErrorMessage(error)} onRetry={reload} />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={FolderSearch}
              title="Aucun projet publié pour le moment"
              description="Nos équipes préparent de nouvelles actions. Revenez bientôt ou soutenez dès maintenant l’ensemble de nos programmes."
              action={<Button href="/don" variant="accent">Faire un don</Button>}
            />
          ) : (
            <>
              <div className="pub-filters">
                <Tabs tabs={tabs} value={status} onChange={setStatus} label="Filtrer par statut" />
                {regions.length > 1 && (
                  <div className="pub-filters__region">
                    <label htmlFor="projects-region">Région</label>
                    <select id="projects-region" className="select" value={region} onChange={(e) => setRegion(e.target.value)}>
                      <option value="">Toutes les régions</option>
                      {regions.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <p className="pub-count" aria-live="polite">{plural(visible.length, "projet affiché", "projets affichés")}</p>
              {visible.length === 0 ? (
                <EmptyState
                  icon={FolderSearch}
                  title="Aucun projet ne correspond à ces critères"
                  description="Essayez une autre région ou un autre statut."
                  action={<Button variant="secondary" onClick={resetFilters}>Réinitialiser les filtres</Button>}
                />
              ) : (
                <div className="grid grid--3">
                  {visible.map((project) => <ProjectCard key={project.id} project={project} />)}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
