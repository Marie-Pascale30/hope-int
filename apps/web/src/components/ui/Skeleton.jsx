// Squelettes de chargement. Sans "use client" : utilisables dans les fichiers loading.jsx (serveur).
import { useTranslations } from "next-intl";
import { cx } from "./utils";

// Blocs decoratifs (aria-hidden) ; le conteneur annonce le chargement aux lecteurs d'ecran.

export function SkeletonRegion({ label, className, children }) {
  const t = useTranslations("ui");
  return (
    <div className={cx("skeleton-region", className)} role="status" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">{label ?? t("loading")}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function SkeletonLine({ width = "100%", height = 12, className }) {
  return <span className={cx("skeleton skeleton-line", className)} style={{ width, height }} />;
}

function SkeletonStatsBlock({ count = 4 }) {
  return (
    <div className="skeleton-stats">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="stat skeleton-stat">
          <div className="stat__top">
            <SkeletonLine width="55%" />
            <span className="skeleton skeleton-stat__icon" />
          </div>
          <SkeletonLine width="70%" height={28} />
          <SkeletonLine width="45%" height={10} />
        </div>
      ))}
    </div>
  );
}

const CELL_WIDTHS = ["70%", "45%", "60%", "35%", "50%", "40%"];

function SkeletonTableBlock({ rows = 6, columns = 4, toolbar = true }) {
  return (
    <div>
      {toolbar && (
        <div className="table-toolbar">
          <span className="skeleton skeleton-input" />
        </div>
      )}
      <div className="table-wrap skeleton-table">
        <div className="skeleton-table__head">
          {Array.from({ length: columns }, (_, index) => <SkeletonLine key={index} width="50%" height={10} />)}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="skeleton-table__row" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }, (_, col) => (
              <SkeletonLine key={col} width={CELL_WIDTHS[(row + col) % CELL_WIDTHS.length]} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonPanelsBlock({ count = 2, chart = true }) {
  return (
    <div className="admin-panels">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="panel">
          <SkeletonLine width="40%" height={16} />
          <SkeletonLine width="65%" height={10} className="skeleton-line--gap" />
          {chart ? <div className="skeleton skeleton-chart" /> : (
            <div className="skeleton-list">
              {Array.from({ length: 4 }, (_, line) => <SkeletonLine key={line} height={40} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 4, toolbar = true, label }) {
  const t = useTranslations("ui");
  return <SkeletonRegion label={label ?? t("loadingTable")}><SkeletonTableBlock rows={rows} columns={columns} toolbar={toolbar} /></SkeletonRegion>;
}

// Squelette de page d'administration.
// variant : "table" (liste), "stats-table" (indicateurs + liste), "dashboard" (indicateurs + panneaux),
// "panels" (panneaux seuls), "list" (cartes empilees).
export function PageSkeleton({ variant = "table", label, rows = 6, columns = 4, stats = 4 }) {
  return (
    <SkeletonRegion label={label} className="skeleton-page">
      {(variant === "stats-table" || variant === "dashboard") && <SkeletonStatsBlock count={stats} />}
      {(variant === "table" || variant === "stats-table") && <SkeletonTableBlock rows={rows} columns={columns} />}
      {variant === "dashboard" && <SkeletonPanelsBlock count={2} />}
      {variant === "panels" && <SkeletonPanelsBlock count={2} chart={false} />}
      {variant === "list" && (
        <div className="skeleton-list">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="panel skeleton-list__item">
              <span className="skeleton skeleton-list__media" />
              <div className="skeleton-list__body">
                <SkeletonLine width="50%" height={14} />
                <SkeletonLine width="80%" height={10} />
              </div>
            </div>
          ))}
        </div>
      )}
    </SkeletonRegion>
  );
}
