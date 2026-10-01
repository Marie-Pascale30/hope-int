"use client";

import "../../styles/admin-a.css";
import { useState } from "react";
import { CalendarDays, GraduationCap, HandCoins, HeartHandshake, MapPinned, Sprout, Users, Wallet } from "lucide-react";
import {
  Badge, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, Select, StatCard, StatusBadge,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatDateTime, formatMoney, formatNumber } from "../../utils/format";
import { PROJECT_STATUS, roleLabel, statusOf, USER_STATUS } from "../../utils/labels";
import { PERMISSIONS as P } from "../../utils/rbac";

const memberColumns = [
  {
    key: "name",
    header: "Membre",
    sortable: true,
    render: (row) => (
      <div className="cell-main">
        <strong>{row.name}</strong>
        <span>{row.email}</span>
      </div>
    ),
  },
  {
    key: "roles",
    header: "Rôles",
    render: (row) => (
      <div className="chip-list">
        {(row.roles || []).map((role) => <Badge key={role} tone={role === "membre" ? undefined : "brand"} plain>{roleLabel(role)}</Badge>)}
      </div>
    ),
  },
  { key: "phone", header: "Téléphone", render: (row) => row.phone || "—" },
  { key: "skills", header: "Compétences", render: (row) => row.skills || "—" },
  { key: "availability", header: "Disponibilités", render: (row) => row.availability || "—" },
  { key: "status", header: "Statut", render: (row) => <StatusBadge status={statusOf(USER_STATUS, row.status)} /> },
];

function RegionalBoard() {
  const [region, setRegion] = useState("");
  const { data, loading, error, reload } = useAsync(() => adminApi.regional(region || undefined), [region]);

  const scope = data?.region || (data?.canChooseRegion ? "Toutes les régions" : "");
  const header = (
    <PageHeader
      eyebrow="Pilotage"
      title={data?.region ? `Région ${data.region}` : "Ma région"}
      description="L'activité de HOPE sur le terrain : impact, dons, projets, événements et membres de la région."
      actions={data?.canChooseRegion && (
        <Select
          label="Région affichée"
          placeholder="Toutes les régions"
          options={data.regions.map((value) => ({ value, label: value }))}
          value={region}
          onChange={(event) => setRegion(event.target.value)}
        />
      )}
    />
  );

  if (loading && !data) return <>{header}<LoadingState label="Chargement du tableau régional…" /></>;
  if (error) {
    if (error.response?.status === 403) {
      return (
        <>
          {header}
          <EmptyState
            icon={MapPinned}
            title="Aucune région associée à votre fiche"
            description={`${getErrorMessage(error)}. Une fois la région renseignée par les RH, ce tableau affichera l'activité de votre territoire.`}
          />
        </>
      );
    }
    return <>{header}<ErrorState message={getErrorMessage(error)} onRetry={reload} /></>;
  }

  const { impact, finance, projects = [], upcomingEvents = [], members = [] } = data;
  const maxProject = Math.max(1, ...finance.byProject.map((row) => row.amountEur));

  return (
    <>
      {header}
      {!data.canChooseRegion && (
        <p className="adm-scope"><MapPinned size={16} aria-hidden="true" /> Périmètre : <strong>{scope}</strong> (région de votre fiche)</p>
      )}

      <div className="admin-grid-stats" aria-busy={loading}>
        <StatCard label="Projets" value={formatNumber(impact.projects)} hint={`${formatNumber(impact.activeProjects)} en cours · ${formatNumber(impact.completedProjects)} terminé(s)`} icon={Sprout} />
        <StatCard label="Bénéficiaires" value={formatNumber(impact.beneficiaries)} hint="Personnes accompagnées" icon={HeartHandshake} tone="info" />
        <StatCard label="Personnes formées" value={formatNumber(impact.trainees)} icon={GraduationCap} />
        <StatCard label="Microcrédits accordés" value={formatNumber(impact.creditsGranted)} icon={Wallet} />
        <StatCard label="Dons collectés" value={formatMoney(finance.totalEur)} hint={`${formatNumber(finance.count)} dons · ${formatNumber(finance.donors)} donateurs`} icon={HandCoins} tone="accent" />
        <StatCard label="Membres" value={formatNumber(members.length)} hint={scope} icon={Users} />
      </div>

      <div className="admin-panels">
        <section className="panel" aria-labelledby="adm-reg-dons">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-reg-dons">Dons par affectation</h2>
              <p className="panel__desc">Dons confirmés, convertis en euros.</p>
            </div>
          </div>
          {finance.byProject.length ? (
            <ul className="adm-bars">
              {finance.byProject.map((row) => (
                <li key={row.projectId ?? "general"}>
                  <div className="adm-bars__label">
                    <span>{row.title}</span>
                    <strong>{formatMoney(row.amountEur)}</strong>
                  </div>
                  <ProgressBar value={(row.amountEur / maxProject) * 100} label={`${row.title} : ${formatMoney(row.amountEur)}`} />
                  <span className="muted adm-small">{formatNumber(row.count)} don{row.count > 1 ? "s" : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-note">Aucun don confirmé pour ce périmètre.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="adm-reg-events">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-reg-events">Événements à venir</h2>
              <p className="panel__desc">Actions terrain publiées dans la région.</p>
            </div>
          </div>
          {upcomingEvents.length ? (
            <ul className="adm-events">
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <CalendarDays size={18} aria-hidden="true" />
                  <div className="cell-main">
                    <strong>{event.title}</strong>
                    <span>{formatDateTime(event.start_at)} · {event.location}</span>
                    <span>
                      {formatNumber(event.registered_count)} inscrit{event.registered_count > 1 ? "s" : ""}
                      {event.capacity ? ` sur ${formatNumber(event.capacity)} places` : " · places illimitées"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-note">Aucun événement programmé pour le moment.</p>
          )}
        </section>
      </div>

      <section className="panel adm-block" aria-labelledby="adm-reg-projects">
        <div className="panel__head">
          <h2 className="panel__title" id="adm-reg-projects">Projets de la région</h2>
        </div>
        {projects.length ? (
          <div className="adm-projects">
            {projects.map((project) => (
              <article key={project.id} className="adm-project">
                <div className="row row--between">
                  <StatusBadge status={statusOf(PROJECT_STATUS, project.status)} />
                  {project.region && <span className="muted adm-small">{project.region}</span>}
                </div>
                <h3>{project.title}</h3>
                {project.summary && <p className="muted adm-small">{project.summary}</p>}
                {project.goal_amount ? (
                  <>
                    <ProgressBar value={project.progress} accent label={`Collecte : ${project.progress} %`} />
                    <div className="progress-meta">
                      <span><strong>{formatMoney(project.raised_eur)}</strong> sur {formatMoney(project.goal_amount)}</span>
                      <span>{project.progress} %</span>
                    </div>
                  </>
                ) : (
                  <span className="muted adm-small">Pas de campagne de collecte</span>
                )}
                <p className="adm-small adm-project__impact">
                  {formatNumber(project.beneficiaries)} bénéficiaires · {formatNumber(project.trainees)} formés · {formatNumber(project.credits_granted)} crédits
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="adm-note">Aucun projet dans ce périmètre.</p>
        )}
      </section>

      <section className="panel adm-block" aria-labelledby="adm-reg-members">
        <div className="panel__head">
          <h2 className="panel__title" id="adm-reg-members">Membres de la région</h2>
        </div>
        <DataTable
          columns={memberColumns}
          rows={members}
          searchKeys={["name", "email", "skills"]}
          searchPlaceholder="Rechercher un membre…"
          pageSize={10}
          emptyTitle="Aucun membre rattaché"
          emptyDescription="Les membres dont la fiche indique cette région apparaîtront ici."
        />
      </section>
    </>
  );
}

export default function Regional() {
  return (
    <RequireAuth permission={P.MANAGE_REGIONAL}>
      <RegionalBoard />
    </RequireAuth>
  );
}
