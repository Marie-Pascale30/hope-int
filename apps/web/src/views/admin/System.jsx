"use client";

import { AlertTriangle, CheckCircle2, Clock, Cpu, Database, RefreshCw, Server } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, ErrorState, PageSkeleton, PageHeader, StatCard } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { useFormat } from "../../i18n/format";
import { adminApi } from "../../services";
import { PERMISSIONS as P } from "../../utils/rbac";
import { useErrorMessage } from "../../i18n/errors";

function formatUptime(t, seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return t("uptimeDays", { days, hours });
  if (hours) return t("uptimeHours", { hours, minutes });
  if (minutes) return t("uptimeMinutes", { minutes });
  return t("uptimeSeconds", { seconds: total });
}

// Habillage traduit ; les diagnostics (libelles et conseils des verifications, erreur de base de
// donnees) sont des textes techniques renvoyes par l'API et affiches tels quels.
function SystemStatus() {
  const t = useTranslations("admin.system");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { data, loading, error, reload } = useAsync(() => adminApi.system(), []);

  const header = (
    <PageHeader
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      actions={<Button variant="secondary" icon={RefreshCw} loading={loading} onClick={reload}>{t("refresh")}</Button>}
    />
  );

  if (loading && !data) return <>{header}<PageSkeleton variant="stats-table" columns={3} label={t("loading")} /></>;
  if (error) return <>{header}<ErrorState message={errorText(error)} onRetry={reload} /></>;

  const { database, checks = [], tables = {} } = data;
  const failing = checks.filter((check) => !check.ok);
  const isProduction = data.environment === "production";
  const environmentLabel = t.has(`environments.${data.environment}`) ? t(`environments.${data.environment}`) : data.environment;
  const tableLabel = (name) => (t.has(`tables.${name}`) ? t(`tables.${name}`) : name);

  return (
    <>
      {header}

      <div className="admin-grid-stats">
        <StatCard
          label={t("database")}
          value={database.ok ? t("dbOk") : t("dbDown")}
          hint={database.ok ? t("dbHint", { version: database.version, latency: database.latencyMs }) : database.error}
          icon={Database}
          tone={database.ok ? undefined : "warning"}
        />
        <StatCard
          label={t("environment")}
          value={environmentLabel}
          hint={t("node", { version: data.nodeVersion })}
          icon={Server}
          tone={isProduction ? undefined : "info"}
        />
        <StatCard label={t("uptime")} value={formatUptime(t, data.uptimeSeconds)} hint={t("uptimeHint")} icon={Clock} />
        <StatCard label={t("memory")} value={t("memoryValue", { value: data.memoryMb })} hint={t("memoryHint")} icon={Cpu} />
      </div>

      <div className="admin-panels">
        <section className="panel" aria-labelledby="adm-checks-title">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-checks-title">{t("checksTitle")}</h2>
              <p className="panel__desc">
                {failing.length ? t("checksFailing", { count: failing.length, total: checks.length }) : t("checksOk")}
              </p>
            </div>
          </div>
          {failing.length > 0 && isProduction && (
            <Alert tone="danger" title={t("productionTitle")}>{t("productionText")}</Alert>
          )}
          <ul className="adm-checks">
            {checks.map((check) => (
              <li key={check.key} className={check.ok ? "is-ok" : "is-warn"}>
                {check.ok
                  ? <CheckCircle2 size={20} aria-hidden="true" />
                  : <AlertTriangle size={20} aria-hidden="true" />}
                <div>
                  <div className="adm-checks__head">
                    <strong>{check.label}</strong>
                    {check.ok ? <Badge tone="success">{t("ok")}</Badge> : <Badge tone="warning">{t("toCheck")}</Badge>}
                  </div>
                  {!check.ok && check.hint && <p>{check.hint}</p>}
                </div>
              </li>
            ))}
          </ul>
          <p className="muted adm-small">{t("checksNote")}</p>
        </section>

        <section className="panel" aria-labelledby="adm-tables-title">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-tables-title">{t("tablesTitle")}</h2>
              <p className="panel__desc">{t("tablesDesc")}</p>
            </div>
          </div>
          {Object.keys(tables).length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t("tableColumn")}</th>
                    <th scope="col" className="num">{t("rowsColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(tables).map(([name, count]) => (
                    <tr key={name}>
                      <td>
                        <div className="cell-main">
                          <strong>{tableLabel(name)}</strong>
                          <span className="adm-mono">{name}</span>
                        </div>
                      </td>
                      <td className="num">{f.number(count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="adm-note">{t("tablesEmpty")}</p>
          )}
        </section>
      </div>
    </>
  );
}

export default function System() {
  return (
    <RequireAuth permission={P.MANAGE_IT}>
      <SystemStatus />
    </RequireAuth>
  );
}
