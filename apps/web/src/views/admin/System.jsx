"use client";

import "../../styles/admin-a.css";
import { AlertTriangle, CheckCircle2, Clock, Cpu, Database, RefreshCw, Server } from "lucide-react";
import { Alert, Badge, Button, ErrorState, LoadingState, PageHeader, StatCard } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatNumber } from "../../utils/format";
import { PERMISSIONS as P } from "../../utils/rbac";

const TABLE_LABELS = {
  users: "Comptes",
  payments: "Paiements",
  projects: "Projets",
  news: "Actualités",
  testimonials: "Témoignages",
  messages: "Messages",
  applications: "Candidatures",
  events: "Événements",
  event_registrations: "Inscriptions aux événements",
  activity_logs: "Journal d'activité",
  subscriptions: "Dons mensuels",
};

const ENVIRONMENTS = { production: "Production", development: "Développement", test: "Test" };

function formatUptime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days} j ${hours} h`;
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return `${minutes} min`;
  return `${total} s`;
}

function SystemStatus() {
  const { data, loading, error, reload } = useAsync(() => adminApi.system(), []);

  const header = (
    <PageHeader
      eyebrow="Système"
      title="État du système"
      description="Santé technique de la plateforme et points de configuration à vérifier avant la mise en production."
      actions={<Button variant="secondary" icon={RefreshCw} loading={loading} onClick={reload}>Actualiser</Button>}
    />
  );

  if (loading && !data) return <>{header}<LoadingState label="Interrogation du serveur…" /></>;
  if (error) return <>{header}<ErrorState message={getErrorMessage(error)} onRetry={reload} /></>;

  const { database, checks = [], tables = {} } = data;
  const failing = checks.filter((check) => !check.ok);
  const isProduction = data.environment === "production";

  return (
    <>
      {header}

      <div className="admin-grid-stats">
        <StatCard
          label="Base de données"
          value={database.ok ? "Opérationnelle" : "Injoignable"}
          hint={database.ok ? `MySQL ${database.version} · ${database.latencyMs} ms` : database.error}
          icon={Database}
          tone={database.ok ? undefined : "warning"}
        />
        <StatCard
          label="Environnement"
          value={ENVIRONMENTS[data.environment] || data.environment}
          hint={`Node.js ${data.nodeVersion}`}
          icon={Server}
          tone={isProduction ? undefined : "info"}
        />
        <StatCard label="Disponibilité" value={formatUptime(data.uptimeSeconds)} hint="Depuis le dernier démarrage de l'API" icon={Clock} />
        <StatCard label="Mémoire utilisée" value={`${formatNumber(data.memoryMb)} Mo`} hint="Processus de l'API (RSS)" icon={Cpu} />
      </div>

      <div className="admin-panels">
        <section className="panel" aria-labelledby="adm-checks-title">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-checks-title">Vérifications de configuration</h2>
              <p className="panel__desc">
                {failing.length
                  ? `${failing.length} point${failing.length > 1 ? "s" : ""} sur ${checks.length} à régler.`
                  : "Tous les points de configuration sont en ordre."}
              </p>
            </div>
          </div>
          {failing.length > 0 && isProduction && (
            <Alert tone="danger" title="Environnement de production">
              Certains réglages manquants exposent la plateforme ou bloquent les dons : à corriger en priorité.
            </Alert>
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
                    {check.ok ? <Badge tone="success">OK</Badge> : <Badge tone="warning">À vérifier</Badge>}
                  </div>
                  {!check.ok && check.hint && <p>{check.hint}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="adm-tables-title">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-tables-title">Volumes par table</h2>
              <p className="panel__desc">Nombre d&apos;enregistrements en base.</p>
            </div>
          </div>
          {Object.keys(tables).length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Table</th>
                    <th scope="col" className="num">Lignes</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(tables).map(([name, count]) => (
                    <tr key={name}>
                      <td>
                        <div className="cell-main">
                          <strong>{TABLE_LABELS[name] || name}</strong>
                          <span className="adm-mono">{name}</span>
                        </div>
                      </td>
                      <td className="num">{formatNumber(count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="adm-note">Volumes indisponibles : la base de données ne répond pas.</p>
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
