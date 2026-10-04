"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, PageSkeleton, PageHeader, StatusBadge } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { useMeta } from "../../hooks/useMeta";
import { useFormat } from "../../i18n/format";
import { adminApi } from "../../services";
import { useErrorMessage } from "../../i18n/errors";
import { useLabels } from "../../utils/labels";
import { PERMISSIONS as P } from "../../utils/rbac";
import { fillMonths, formatEur, providerLabel, toEur } from "./parts-b/finance";
import { InlineSelect, MonthlyChart, MonthTable, ShareTable } from "./parts-b/widgets";

function Figure({ value, label, detail }) {
  return (
    <div className="adm-report-figure">
      <strong>{value}</strong>
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function Report({ report, organization, xafPerEur }) {
  const t = useTranslations("adminOps.report");
  const f = useFormat();
  const labels = useLabels();
  const { year, finance, activity, impact, region } = report;
  const applications = activity.applications || {};
  const received = Object.values(applications).reduce((sum, value) => sum + Number(value || 0), 0);
  const months = fillMonths(finance.byMonth, year);
  const n = (value) => f.number(value || 0);

  return (
    <article className="adm-report" aria-labelledby="adm-report-title">
      <header className="adm-report__head">
        <div>
          <span className="eyebrow">{organization.name}</span>
          <h1 id="adm-report-title">{t("heading", { year })}</h1>
          <p>
            {t("period", { start: f.date(`${year}-01-01`), end: f.date(`${year}-12-31`) })}
            {region && <> · <strong>{t("regionScope", { region })}</strong></>}
          </p>
        </div>
        <p>{t("generatedAt", { date: f.dateTime(report.generatedAt) })}</p>
      </header>

      <section aria-labelledby="adm-r-highlights">
        <h2 id="adm-r-highlights">{t("highlights.title")}</h2>
        <div className="adm-report-figures">
          <Figure
            value={formatEur(f, finance.totalEur)}
            label={t("highlights.collected")}
            detail={t("highlights.collectedDetail", { count: Number(finance.count) || 0 })}
          />
          <Figure
            value={n(finance.donors)}
            label={t("highlights.donors", { count: Number(finance.donors) || 0 })}
            detail={t("highlights.donorsDetail", { count: Number(finance.recurringDonors) || 0 })}
          />
          <Figure value={n(activity.newMembers)} label={t("highlights.newMembers", { count: Number(activity.newMembers) || 0 })} />
          <Figure
            value={n(activity.events)}
            label={t("highlights.events", { count: Number(activity.events) || 0 })}
            detail={t("highlights.eventsDetail", { count: Number(activity.eventRegistrations) || 0 })}
          />
          <Figure
            value={n(received)}
            label={t("highlights.applications", { count: received })}
            detail={t("highlights.applicationsDetail", { count: Number(applications.acceptee) || 0 })}
          />
          <Figure
            value={n(activity.messages?.handled)}
            label={t("highlights.messages", { count: Number(activity.messages?.handled) || 0 })}
            detail={t("highlights.messagesDetail", { count: Number(activity.messages?.total) || 0 })}
          />
        </div>
      </section>

      <section aria-labelledby="adm-r-impact">
        <h2 id="adm-r-impact">{t("impact.title")}</h2>
        {/* Note de l'API (francais) non affichee : seule la base de calcul est interpretee. */}
        {report.impactScope?.basis === "projects_active_in_year" && (
          <p className="adm-muted-small" style={{ marginTop: 0 }}>
            {region ? t("impact.scopeNoteRegion", { year, region }) : t("impact.scopeNote", { year })}
          </p>
        )}
        <div className="adm-report-figures">
          <Figure value={n(impact.beneficiaries)} label={t("impact.beneficiaries", { count: Number(impact.beneficiaries) || 0 })} />
          <Figure value={n(impact.trainees)} label={t("impact.trainees", { count: Number(impact.trainees) || 0 })} />
          <Figure value={n(impact.creditsGranted)} label={t("impact.credits", { count: Number(impact.creditsGranted) || 0 })} />
          <Figure
            value={n(impact.activeProjects)}
            label={t("impact.activeProjects", { count: Number(impact.activeProjects) || 0 })}
            detail={t("impact.completedDetail", { count: Number(impact.completedProjects) || 0, total: n(impact.projects) })}
          />
          <Figure value={n(impact.regionsCovered)} label={t("impact.regions", { count: Number(impact.regionsCovered) || 0 })} />
        </div>
      </section>

      <section aria-labelledby="adm-r-finance">
        <h2 id="adm-r-finance">{t("finance.title")}</h2>
        {finance.count === 0 ? (
          <p className="muted">{t("finance.empty", { year })}</p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {t.rich("finance.average", { amount: formatEur(f, finance.averageEur), strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
            <h3>{t("finance.monthly")}</h3>
            <MonthlyChart months={months} />
            <h3>{t("finance.monthlyDetail")}</h3>
            <MonthTable months={months} />
            <h3>{t("finance.byProject")}</h3>
            <ShareTable
              rows={finance.byProject.map((row) => ({
                key: row.projectId ?? "general",
                label: row.projectId ? row.title : t("finance.generalFund"),
                count: row.count,
                value: row.amountEur,
              }))}
              labelHeader={t("finance.allocationHeader")}
              caption={t("finance.byProjectCaption")}
            />
            <h3>{t("finance.byProvider")}</h3>
            <ShareTable
              rows={finance.byProvider.map((row) => ({
                key: `${row.provider}-${row.method}`,
                label: providerLabel(labels, row.provider, row.method),
                count: row.count,
                value: row.amountEur,
              }))}
              labelHeader={t("finance.methodHeader")}
              caption={t("finance.byProviderCaption")}
            />
            <p className="adm-muted-small" style={{ marginTop: 10 }}>
              {t("finance.byCurrency")}{" "}
              {finance.byCurrency
                .map((row) =>
                  row.currency === "xaf"
                    ? t("finance.currencyXaf", {
                        amount: f.money(row.amount, row.currency),
                        count: Number(row.count) || 0,
                        eur: formatEur(f, toEur(row.amount, "xaf", xafPerEur)),
                      })
                    : t("finance.currency", { amount: f.money(row.amount, row.currency), count: Number(row.count) || 0 })
                )
                .join(" · ")}
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="adm-r-projects">
        <h2 id="adm-r-projects">{t("projects.title")}</h2>
        {activity.projects?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t("projects.project")}</th>
                  <th scope="col">{t("projects.status")}</th>
                  <th scope="col">{t("projects.region")}</th>
                  <th scope="col" className="num">{t("projects.beneficiaries")}</th>
                  <th scope="col" className="num">{t("projects.trainees")}</th>
                  <th scope="col" className="num">{t("projects.credits")}</th>
                  <th scope="col">{t("projects.period")}</th>
                </tr>
              </thead>
              <tbody>
                {activity.projects.map((project) => (
                  <tr key={project.id}>
                    <td><strong>{project.title}</strong></td>
                    <td><StatusBadge status={labels.status("projectStatus", project.status)} /></td>
                    <td>{project.region || "—"}</td>
                    <td className="num">{n(project.beneficiaries)}</td>
                    <td className="num">{n(project.trainees)}</td>
                    <td className="num">{n(project.credits_granted)}</td>
                    <td className="adm-nowrap">
                      {project.start_date ? f.shortDate(project.start_date) : "—"}
                      {" → "}
                      {project.end_date ? f.shortDate(project.end_date) : t("projects.ongoing")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{t("projects.empty")}</p>
        )}
      </section>

      <footer className="adm-report__foot">
        {organization.name}
        {organization.address ? ` — ${organization.address}` : ""} ·{" "}
        {t("footer", { date: f.date(report.generatedAt), rate: f.number(xafPerEur, { maximumFractionDigits: 3 }) })}
      </footer>
    </article>
  );
}

function AnnualReportView() {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.report");
  const { meta } = useMeta();
  const [year, setYear] = useState("");
  const { data, loading, error, reload } = useAsync(() => adminApi.annualReport(year || undefined), [year]);

  const yearOptions = useMemo(
    () => (data?.availableYears || [new Date().getFullYear()]).map((value) => ({ value: String(value), label: String(value) })),
    [data]
  );

  return (
    <>
      <div className="adm-noprint">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={data?.region ? t("descriptionRegion", { region: data.region }) : t("description")}
          actions={
            <>
              <InlineSelect label={t("year")} value={year || String(data?.year || "")} onChange={setYear} options={yearOptions} />
              <Button icon={Printer} onClick={() => window.print()} disabled={!data}>{t("print")}</Button>
            </>
          }
        />
      </div>

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading || !data ? (
        <PageSkeleton variant="dashboard" label={t("loading")} />
      ) : data.finance && data.activity ? (
        <Report report={data} organization={meta.organization} xafPerEur={meta.xafPerEur} />
      ) : (
        <EmptyState title={t("unavailableTitle")} description={t("unavailableText")} />
      )}
    </>
  );
}

export default function AnnualReport() {
  return (
    <RequireAuth permission={P.VIEW_STATS}>
      <AnnualReportView />
    </RequireAuth>
  );
}
