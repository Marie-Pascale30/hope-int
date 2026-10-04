"use client";

import { useState } from "react";
import { CalendarDays, GraduationCap, HandCoins, HeartHandshake, MapPinned, Sprout, Users, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Badge, DataTable, EmptyState, ErrorState, PageSkeleton, PageHeader, ProgressBar, Select, StatCard, StatusBadge,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { useFormat } from "../../i18n/format";
import { adminApi } from "../../services";
import { useLabels } from "../../utils/labels";
import { PERMISSIONS as P } from "../../utils/rbac";
import { useErrorMessage } from "../../i18n/errors";

function useMemberColumns() {
  const t = useTranslations("admin.regional.members");
  const tc = useTranslations("admin.common");
  const labels = useLabels();
  return [
    {
      key: "name",
      header: t("member"),
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
      header: tc("roles"),
      render: (row) => (
        <div className="chip-list">
          {(row.roles || []).map((role) => (
            <Badge key={role} tone={role === "membre" ? undefined : "brand"} plain>{labels.role(role)}</Badge>
          ))}
        </div>
      ),
    },
    { key: "phone", header: tc("phone"), render: (row) => row.phone || "—" },
    { key: "skills", header: tc("skills"), render: (row) => row.skills || "—" },
    { key: "availability", header: tc("availability"), render: (row) => row.availability || "—" },
    { key: "status", header: tc("status"), render: (row) => <StatusBadge status={labels.status("userStatus", row.status)} /> },
  ];
}

function RegionalBoard() {
  const t = useTranslations("admin.regional");
  const f = useFormat();
  const labels = useLabels();
  const errorText = useErrorMessage();
  const memberColumns = useMemberColumns();
  const [region, setRegion] = useState("");
  const { data, loading, error, reload } = useAsync(() => adminApi.regional(region || undefined), [region]);

  const scopeName = data?.region || t("allRegions");
  const header = (
    <PageHeader
      eyebrow={t("eyebrow")}
      title={data?.region ? t("titleRegion", { region: data.region }) : t("title")}
      description={t("description")}
      actions={data?.canChooseRegion && (
        <Select
          label={t("regionSelect")}
          placeholder={t("allRegions")}
          options={data.regions.map((value) => ({ value, label: value }))}
          value={region}
          onChange={(event) => setRegion(event.target.value)}
        />
      )}
    />
  );

  if (loading && !data) return <>{header}<PageSkeleton variant="dashboard" label={t("loading")} /></>;
  if (error) {
    if (error.response?.status === 403) {
      return (
        <>
          {header}
          <EmptyState
            icon={MapPinned}
            title={t("noRegionTitle")}
            description={<>{errorText(error)}<br />{t("noRegionText")}</>}
          />
        </>
      );
    }
    return <>{header}<ErrorState message={errorText(error)} onRetry={reload} /></>;
  }

  const { impact, finance, projects = [], upcomingEvents = [], members = [] } = data;
  const maxProject = Math.max(1, ...finance.byProject.map((row) => row.amountEur));

  let scopeText;
  if (!data.canChooseRegion) scopeText = t("scope", { region: data.region });
  else scopeText = data.region ? t("scopeChosen", { region: data.region }) : t("scopeAll");

  const eventLine = (event) => {
    if (event.capacity) return t("events.capacity", { count: Number(event.registered_count) || 0, capacity: Number(event.capacity) });
    return t("events.unlimited", { count: Number(event.registered_count) || 0 });
  };

  return (
    <>
      {header}
      <p className="adm-scope" role="note"><MapPinned size={16} aria-hidden="true" /> <strong>{scopeText}</strong></p>

      <div className="admin-grid-stats" aria-busy={loading}>
        <StatCard
          label={t("stats.projects")}
          value={f.number(impact.projects)}
          hint={t("stats.projectsHint", { active: impact.activeProjects, completed: impact.completedProjects })}
          icon={Sprout}
        />
        <StatCard label={t("stats.beneficiaries")} value={f.number(impact.beneficiaries)} hint={t("stats.beneficiariesHint")} icon={HeartHandshake} tone="info" />
        <StatCard label={t("stats.trainees")} value={f.number(impact.trainees)} icon={GraduationCap} />
        <StatCard label={t("stats.credits")} value={f.number(impact.creditsGranted)} icon={Wallet} />
        <StatCard
          label={t("stats.donations")}
          value={f.money(finance.totalEur)}
          hint={t("stats.donationsHint", { count: finance.count, donors: finance.donors })}
          icon={HandCoins}
          tone="accent"
        />
        <StatCard label={t("stats.members")} value={f.number(members.length)} hint={scopeName} icon={Users} />
      </div>

      <div className="admin-panels">
        <section className="panel" aria-labelledby="adm-reg-dons">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-reg-dons">{t("byProject.title")}</h2>
              <p className="panel__desc">{t("byProject.description")}</p>
            </div>
          </div>
          {finance.byProject.length ? (
            <ul className="adm-bars">
              {finance.byProject.map((row) => (
                <li key={row.projectId ?? "general"}>
                  <div className="adm-bars__label">
                    <span>{row.title}</span>
                    <strong>{f.money(row.amountEur)}</strong>
                  </div>
                  <ProgressBar
                    value={(row.amountEur / maxProject) * 100}
                    label={t("byProject.barLabel", { title: row.title, amount: f.money(row.amountEur) })}
                  />
                  <span className="muted adm-small">{t("byProject.count", { count: row.count })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-note">{t("byProject.empty")}</p>
          )}
        </section>

        <section className="panel" aria-labelledby="adm-reg-events">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-reg-events">{t("events.title")}</h2>
              <p className="panel__desc">{t("events.description")}</p>
            </div>
          </div>
          {upcomingEvents.length ? (
            <ul className="adm-events">
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <CalendarDays size={18} aria-hidden="true" />
                  <div className="cell-main">
                    <strong>{event.title}</strong>
                    <span>{t("events.where", { date: f.dateTime(event.start_at), location: event.location })}</span>
                    <span>{eventLine(event)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-note">{t("events.empty")}</p>
          )}
        </section>
      </div>

      <section className="panel adm-block" aria-labelledby="adm-reg-projects">
        <div className="panel__head">
          <h2 className="panel__title" id="adm-reg-projects">{t("projects.title")}</h2>
        </div>
        {projects.length ? (
          <div className="adm-projects">
            {projects.map((project) => (
              <article key={project.id} className="adm-project">
                <div className="row row--between">
                  <StatusBadge status={labels.status("projectStatus", project.status)} />
                  {project.region && <span className="muted adm-small">{project.region}</span>}
                </div>
                <h3>{project.title}</h3>
                {project.summary && <p className="muted adm-small">{project.summary}</p>}
                {project.goal_amount ? (
                  <>
                    <ProgressBar value={project.progress} accent label={t("projects.progressLabel", { progress: project.progress })} />
                    <div className="progress-meta">
                      <span>
                        {t.rich("projects.raised", {
                          raised: f.money(project.raised_eur),
                          goal: f.money(project.goal_amount),
                          strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                      </span>
                      <span>{t("projects.percent", { progress: project.progress })}</span>
                    </div>
                  </>
                ) : (
                  <span className="muted adm-small">{t("projects.noCampaign")}</span>
                )}
                <p className="adm-small adm-project__impact">
                  {t("projects.impact", {
                    beneficiaries: project.beneficiaries || 0,
                    trainees: project.trainees || 0,
                    credits: project.credits_granted || 0,
                  })}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="adm-note">{t("projects.empty")}</p>
        )}
      </section>

      <section className="panel adm-block" aria-labelledby="adm-reg-members">
        <div className="panel__head">
          <h2 className="panel__title" id="adm-reg-members">{t("members.title")}</h2>
        </div>
        <DataTable
          columns={memberColumns}
          rows={members}
          searchKeys={["name", "email", "skills"]}
          searchPlaceholder={t("members.search")}
          pageSize={10}
          emptyTitle={t("members.emptyTitle")}
          emptyDescription={t("members.emptyText")}
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
