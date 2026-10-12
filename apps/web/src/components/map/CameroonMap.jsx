// Carte interactive des regions (SVG maison, sans bibliotheque ni tuiles) : chaque region est un
// lien nomme (nombre de projets et d'evenements) vers la liste des projets filtree ; navigation au
// clavier (Tab), focus visible, couleurs issues des variables CSS (mode sombre).
// Composant sans etat : rendu cote serveur ou client.
import { useTranslations } from "next-intl";
import { useLocalePath } from "@/src/i18n/navigation";
import { MAP_HEIGHT, MAP_WIDTH, REGION_PATHS, intensity } from "./cameroonRegions";

// Libelles courts affiches sur la carte (les noms complets restent dans le nom accessible).
const SHORT = { "Extrême-Nord": "Extr.-Nord", "Nord-Ouest": "N.-Ouest", "Sud-Ouest": "S.-Ouest" };

// regions : [{ region, projects, activeProjects, events }] (GET /api/transparency/regions).
// selected : region mise en evidence ; hrefFor(region) : lien d'une region.
export default function CameroonMap({ regions = [], selected, hrefFor, titleId = "cmr-map-title", showList = true }) {
  const t = useTranslations("transparency.map");
  const lp = useLocalePath();
  const byRegion = new Map(regions.map((row) => [row.region, row]));
  const max = Math.max(0, ...regions.map((row) => row.projects || 0));
  const link = (region) => (hrefFor ? hrefFor(region) : lp(`/projets?region=${encodeURIComponent(region)}#projets-liste`));
  const label = (region) => {
    const row = byRegion.get(region) || {};
    return t("regionLabel", { region, projects: row.projects || 0, events: row.events || 0 });
  };

  return (
    <div className="cmr-map">
      <svg
        className="cmr-map__svg"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="group"
        aria-labelledby={titleId}
        focusable="false"
      >
        {REGION_PATHS.map(({ region, d }) => {
          const row = byRegion.get(region) || {};
          const level = intensity(row.projects, max);
          const isSelected = selected === region;
          return (
            <a
              key={region}
              href={link(region)}
              className={`cmr-map__region cmr-map__region--l${level}${isSelected ? " is-selected" : ""}`}
              aria-label={label(region)}
              aria-current={isSelected ? "true" : undefined}
            >
              <title>{label(region)}</title>
              <path d={d} />
            </a>
          );
        })}
        <g className="cmr-map__labels" aria-hidden="true">
          {REGION_PATHS.map(({ region, center }) => {
            const row = byRegion.get(region) || {};
            return (
              <g key={region} transform={`translate(${center[0]} ${center[1]})`}>
                <text className="cmr-map__name" y={row.projects ? -4 : 3}>{SHORT[region] || region}</text>
                {row.projects > 0 && <text className="cmr-map__count" y={10}>{row.projects}</text>}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="cmr-map__legend" aria-hidden="true">
        <span>{t("legendFew")}</span>
        <span className="cmr-map__scale">
          {[0, 1, 2, 3].map((level) => <i key={level} className={`cmr-map__swatch cmr-map__region--l${level}`} />)}
        </span>
        <span>{t("legendMany")}</span>
      </div>
      {showList && (
        <ul className="cmr-map__list">
          {REGION_PATHS.map(({ region }) => {
            const row = byRegion.get(region) || {};
            return (
              <li key={region}>
                <a href={link(region)} aria-current={selected === region ? "true" : undefined}>
                  <span>{region}</span>
                  <span className="cmr-map__list-count">
                    {t("projectsShort", { count: row.projects || 0 })}
                    {row.events > 0 && <> · {t("eventsShort", { count: row.events })}</>}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
