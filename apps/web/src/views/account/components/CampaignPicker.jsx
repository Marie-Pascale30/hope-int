"use client";

import { MapPin, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, ProgressBar } from "../../../components/ui";
import { useFormat } from "../../../i18n/format";
import { useLabels } from "../../../utils/labels";

function CampaignProgress({ project }) {
  const t = useTranslations("account.campaigns");
  const f = useFormat();
  if (!project.goal_amount) return null;
  return (
    <div className="don-campaign__progress">
      <ProgressBar value={project.progress} accent label={t("progressLabel", { title: project.title })} />
      <div className="progress-meta">
        <span>
          {t.rich("raised", { amount: f.money(project.raised_eur), strong: (chunks) => <strong>{chunks}</strong> })}
        </span>
        <span>
          {t("progress", { percent: f.number(project.progress), goal: f.money(project.goal_amount) })}
        </span>
      </div>
    </div>
  );
}

// Choix de l'affectation : fonds general ou campagne en cours (avec sa progression).
export default function CampaignPicker({ campaigns, loading, error, onRetry, value, onChange, name = "don-affectation" }) {
  const t = useTranslations("account.campaigns");
  const f = useFormat();
  const labels = useLabels();
  const options = [{ id: "", title: t("general") }, ...campaigns];

  return (
    <div className="don-campaigns" role="radiogroup" aria-label={t("label")}>
      {options.map((project) => {
        const id = String(project.id);
        const checked = value === id;
        const general = id === "";
        const status = general ? null : labels.status("projectStatus", project.status);
        return (
          <label key={id || "general"} className={`don-campaign${checked ? " is-checked" : ""}`}>
            <input type="radio" name={name} value={id} checked={checked} onChange={() => onChange(id)} />
            <span className="don-campaign__radio" aria-hidden="true" />
            <span className="don-campaign__body">
              <span className="don-campaign__head">
                <span className="don-campaign__title">{project.title}</span>
                {general ? (
                  <Badge tone="accent">{t("recommended")}</Badge>
                ) : (
                  <Badge tone={status.tone}>{status.label}</Badge>
                )}
              </span>
              {general ? (
                <span className="don-campaign__text">
                  <Sparkles size={14} aria-hidden="true" /> {t("generalText")}
                </span>
              ) : (
                <span className="don-campaign__text">
                  <MapPin size={14} aria-hidden="true" />{" "}
                  {project.donors_count > 0
                    ? t("regionDonors", { region: project.region || t("country"), count: project.donors_count })
                    : project.region || t("country")}
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
        <Alert tone="warning" title={t("errorTitle")}>
          {t("errorText")}{" "}
          <Button variant="ghost" size="sm" onClick={onRetry}>{t("retry")}</Button>
        </Alert>
      )}
    </div>
  );
}
