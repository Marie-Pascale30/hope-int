"use client";

// Filtres de la liste des projets (statut, region) : rendu initial complet cote serveur.
import { useMemo, useState } from "react";
import { FolderSearch } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, EmptyState, Tabs } from "../../../components/ui";
import { ProjectCard } from ".";

const STATUSES = ["all", "en_cours", "planifie", "termine"];

export default function ProjectsBrowser({ projects }) {
  const t = useTranslations("site.projects");
  const locale = useLocale();
  const [status, setStatus] = useState("all");
  const [region, setRegion] = useState("");

  const regions = useMemo(
    () => [...new Set(projects.map((p) => p.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale)),
    [projects, locale]
  );
  const byRegion = region ? projects.filter((p) => p.region === region) : projects;
  const visible = status === "all" ? byRegion : byRegion.filter((p) => p.status === status);
  const tabs = STATUSES.map((value) => ({
    value,
    label: t(`tabs.${value}`),
    count: value === "all" ? byRegion.length : byRegion.filter((p) => p.status === value).length,
  }));

  const resetFilters = () => {
    setStatus("all");
    setRegion("");
  };

  return (
    <>
      <div className="pub-filters">
        <Tabs tabs={tabs} value={status} onChange={setStatus} label={t("filterStatus")} />
        {regions.length > 1 && (
          <div className="pub-filters__region">
            <label htmlFor="projects-region">{t("region")}</label>
            <select id="projects-region" className="select" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">{t("allRegions")}</option>
              {regions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}
      </div>
      <p className="pub-count" aria-live="polite">{t("count", { count: visible.length })}</p>
      {visible.length === 0 ? (
        <EmptyState
          icon={FolderSearch}
          title={t("noMatchTitle")}
          description={t("noMatchText")}
          action={<Button variant="secondary" onClick={resetFilters}>{t("reset")}</Button>}
        />
      ) : (
        <div className="grid grid--3">
          {visible.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}
    </>
  );
}
