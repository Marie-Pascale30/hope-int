"use client";

import "../../styles/admin-b.css";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { useMeta } from "../../hooks/useMeta";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatShortDate } from "../../utils/format";
import { PROJECT_STATUS, statusOf } from "../../utils/labels";
import { PERMISSIONS as P } from "../../utils/rbac";
import { fillMonths, formatEur, providerLabel, toEur } from "./parts-b/finance";
import { InlineSelect, MonthlyChart, MonthTable, ShareTable } from "./parts-b/widgets";

function Figure({ value, label, detail }) {
  return (
    <div className="admb-figure">
      <strong>{value}</strong>
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function Report({ report, organization, xafPerEur }) {
  const { year, finance, activity, impact } = report;
  const applications = activity.applications || {};
  const received = Object.values(applications).reduce((sum, value) => sum + Number(value || 0), 0);
  const months = fillMonths(finance.byMonth, year);

  return (
    <article className="admb-report" aria-labelledby="admb-report-title">
      <header className="admb-report__head">
        <div>
          <span className="eyebrow">{organization.name}</span>
          <h1 id="admb-report-title">Rapport d&apos;activité {year}</h1>
          <p>Période du 1er janvier au 31 décembre {year}</p>
        </div>
        <p>Généré le {formatDateTime(report.generatedAt)}</p>
      </header>

      <section aria-labelledby="admb-r-highlights">
        <h2 id="admb-r-highlights">Faits marquants</h2>
        <div className="admb-figures">
          <Figure value={formatEur(finance.totalEur)} label="collectés" detail={`${formatNumber(finance.count)} don(s) réussi(s)`} />
          <Figure
            value={formatNumber(finance.donors)}
            label="donateurs"
            detail={`dont ${formatNumber(finance.recurringDonors)} en don mensuel`}
          />
          <Figure value={formatNumber(activity.newMembers)} label="nouveaux membres" />
          <Figure
            value={formatNumber(activity.events)}
            label="événements organisés"
            detail={`${formatNumber(activity.eventRegistrations)} inscription(s)`}
          />
          <Figure
            value={formatNumber(received)}
            label="candidatures reçues"
            detail={`${formatNumber(applications.acceptee || 0)} acceptée(s)`}
          />
          <Figure
            value={formatNumber(activity.messages?.handled || 0)}
            label="messages traités"
            detail={`sur ${formatNumber(activity.messages?.total || 0)} reçu(s)`}
          />
        </div>
      </section>

      <section aria-labelledby="admb-r-impact">
        <h2 id="admb-r-impact">Impact cumulé</h2>
        <div className="admb-figures">
          <Figure value={formatNumber(impact.beneficiaries)} label="bénéficiaires" />
          <Figure value={formatNumber(impact.trainees)} label="personnes formées" />
          <Figure value={formatNumber(impact.creditsGranted)} label="crédits accordés" />
          <Figure
            value={formatNumber(impact.activeProjects)}
            label="projets en cours"
            detail={`${formatNumber(impact.completedProjects)} terminé(s) sur ${formatNumber(impact.projects)}`}
          />
          <Figure value={formatNumber(impact.regionsCovered)} label="régions couvertes" />
        </div>
      </section>

      <section aria-labelledby="admb-r-finance">
        <h2 id="admb-r-finance">Finances</h2>
        {finance.count === 0 ? (
          <p className="muted">Aucun don réussi n&apos;a été enregistré en {year}.</p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Don moyen : <strong>{formatEur(finance.averageEur)}</strong>.
            </p>
            <h3>Montant collecté par mois (EUR)</h3>
            <MonthlyChart months={months} />
            <h3>Détail mensuel</h3>
            <MonthTable months={months} />
            <h3>Par affectation</h3>
            <ShareTable
              rows={finance.byProject.map((row) => ({
                key: row.projectId ?? "general",
                label: row.title,
                count: row.count,
                value: row.amountEur,
              }))}
              labelHeader="Affectation"
              caption="Dons par affectation"
            />
            <h3>Par moyen de paiement</h3>
            <ShareTable
              rows={finance.byProvider.map((row) => ({
                key: `${row.provider}-${row.method}`,
                label: providerLabel(row.provider, row.method),
                count: row.count,
                value: row.amountEur,
              }))}
              labelHeader="Moyen"
              caption="Dons par moyen de paiement"
            />
            <p className="admb-muted-small" style={{ marginTop: 10 }}>
              Par devise :{" "}
              {finance.byCurrency
                .map((row) =>
                  `${formatMoney(row.amount, row.currency)} (${formatNumber(row.count)} don(s)${
                    row.currency === "xaf" ? `, soit ${formatEur(toEur(row.amount, "xaf", xafPerEur))}` : ""
                  })`
                )
                .join(" · ")}
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="admb-r-projects">
        <h2 id="admb-r-projects">Projets de l&apos;année</h2>
        {activity.projects?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Projet</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Région</th>
                  <th scope="col" className="num">Bénéficiaires</th>
                  <th scope="col" className="num">Formés</th>
                  <th scope="col" className="num">Crédits</th>
                  <th scope="col">Période</th>
                </tr>
              </thead>
              <tbody>
                {activity.projects.map((project) => (
                  <tr key={project.id}>
                    <td><strong>{project.title}</strong></td>
                    <td><StatusBadge status={statusOf(PROJECT_STATUS, project.status)} /></td>
                    <td>{project.region || "—"}</td>
                    <td className="num">{formatNumber(project.beneficiaries)}</td>
                    <td className="num">{formatNumber(project.trainees)}</td>
                    <td className="num">{formatNumber(project.credits_granted)}</td>
                    <td className="admb-nowrap">
                      {project.start_date ? formatShortDate(project.start_date) : "—"}
                      {" → "}
                      {project.end_date ? formatShortDate(project.end_date) : "en cours"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Aucun projet actif sur cette année.</p>
        )}
      </section>

      <footer className="admb-report__foot">
        {organization.name}
        {organization.address ? ` — ${organization.address}` : ""} · Document généré le {formatDate(report.generatedAt)} à partir
        des données de la plateforme. Montants en francs CFA convertis en euros à la parité fixe de 1 € ={" "}
        {formatNumber(xafPerEur, { maximumFractionDigits: 3 })} FCFA.
      </footer>
    </article>
  );
}

function AnnualReportView() {
  const { meta } = useMeta();
  const [year, setYear] = useState("");
  const { data, loading, error, reload } = useAsync(() => adminApi.annualReport(year || undefined), [year]);

  const yearOptions = useMemo(
    () => (data?.availableYears || [new Date().getFullYear()]).map((value) => ({ value: String(value), label: String(value) })),
    [data]
  );

  return (
    <>
      <div className="admb-noprint">
        <PageHeader
          eyebrow="Pilotage"
          title="Rapport annuel"
          description="Une synthèse prête à partager avec le conseil d'administration, les partenaires et les donateurs."
          actions={
            <>
              <InlineSelect label="Année" value={year || String(data?.year || "")} onChange={setYear} options={yearOptions} />
              <Button icon={Printer} onClick={() => window.print()} disabled={!data}>Imprimer / PDF</Button>
            </>
          }
        />
      </div>

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState label="Préparation du rapport…" />
      ) : data.finance && data.activity ? (
        <Report report={data} organization={meta.organization} xafPerEur={meta.xafPerEur} />
      ) : (
        <EmptyState title="Rapport indisponible" description="Aucune donnée n'a pu être rassemblée pour cette année." />
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
