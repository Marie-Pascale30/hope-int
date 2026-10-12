// Section "Nos actions dans les 10 regions" : carte interactive + resume (accueil, projets).
import "@/src/styles/transparency.css";
import { useTranslations } from "next-intl";
import CameroonMap from "@/src/components/map/CameroonMap";

export default function RegionMapSection({ regions, selected, alt = false, compact = false }) {
  const t = useTranslations("transparency.map");
  if (!regions?.length) return null;
  const covered = regions.filter((row) => row.projects > 0).length;
  const projects = regions.reduce((sum, row) => sum + (row.projects || 0), 0);
  const events = regions.reduce((sum, row) => sum + (row.events || 0), 0);
  return (
    <section className={`section${alt ? " section--alt" : ""}${compact ? " section--tight" : ""}`} aria-labelledby="regions-map-title">
      <div className="container map-section">
        <div className="map-section__text">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h2 id="regions-map-title">{t("title")}</h2>
          <p>{t("text", { covered, projects, events })}</p>
          <p className="muted">{t("hint")}</p>
        </div>
        <CameroonMap regions={regions} selected={selected} titleId="regions-map-title" />
      </div>
    </section>
  );
}
