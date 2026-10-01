"use client";

import { MapPin, Sparkles } from "lucide-react";
import { Alert, Badge, Button, ProgressBar } from "../../../components/ui";
import { formatMoney, formatNumber } from "../../../utils/format";
import { PROJECT_STATUS, statusOf } from "../../../utils/labels";

function CampaignProgress({ project }) {
  if (!project.goal_amount) return null;
  return (
    <div className="don-campaign__progress">
      <ProgressBar value={project.progress} accent label={`Progression de la campagne ${project.title}`} />
      <div className="progress-meta">
        <span>
          <strong>{formatMoney(project.raised_eur)}</strong> collectés
        </span>
        <span>
          {project.progress} % de {formatMoney(project.goal_amount)}
        </span>
      </div>
    </div>
  );
}

// Choix de l'affectation : fonds general ou campagne en cours (avec sa progression).
export default function CampaignPicker({ campaigns, loading, error, onRetry, value, onChange, name = "don-affectation" }) {
  const options = [{ id: "", title: "Là où c’est le plus utile" }, ...campaigns];

  return (
    <div className="don-campaigns" role="radiogroup" aria-label="Affectation de votre don">
      {options.map((project) => {
        const id = String(project.id);
        const checked = value === id;
        const general = id === "";
        return (
          <label key={id || "general"} className={`don-campaign${checked ? " is-checked" : ""}`}>
            <input type="radio" name={name} value={id} checked={checked} onChange={() => onChange(id)} />
            <span className="don-campaign__radio" aria-hidden="true" />
            <span className="don-campaign__body">
              <span className="don-campaign__head">
                <span className="don-campaign__title">{project.title}</span>
                {general ? (
                  <Badge tone="accent">Recommandé</Badge>
                ) : (
                  <Badge tone={statusOf(PROJECT_STATUS, project.status).tone}>{statusOf(PROJECT_STATUS, project.status).label}</Badge>
                )}
              </span>
              {general ? (
                <span className="don-campaign__text">
                  <Sparkles size={14} aria-hidden="true" /> Notre équipe oriente votre don vers les besoins les plus urgents :
                  microcrédits, formations, entraide.
                </span>
              ) : (
                <span className="don-campaign__text">
                  <MapPin size={14} aria-hidden="true" /> {project.region || "Cameroun"}
                  {project.donors_count > 0 && ` · ${formatNumber(project.donors_count)} donateur${project.donors_count > 1 ? "s" : ""}`}
                </span>
              )}
              {checked && !general && project.summary && <span className="don-campaign__summary">{project.summary}</span>}
              {!general && <CampaignProgress project={project} />}
            </span>
          </label>
        );
      })}

      {loading && (
        <div className="don-campaign don-campaign--loading" aria-hidden="true">
          <span className="skeleton" style={{ height: 18, width: "60%" }} />
          <span className="skeleton" style={{ height: 8, width: "100%" }} />
        </div>
      )}
      {error && (
        <Alert tone="warning" title="Campagnes indisponibles">
          La liste des campagnes n’a pas pu être chargée. Votre don peut tout de même être affecté là où c’est le plus utile.{" "}
          <Button variant="ghost" size="sm" onClick={onRetry}>Réessayer</Button>
        </Alert>
      )}
    </div>
  );
}
