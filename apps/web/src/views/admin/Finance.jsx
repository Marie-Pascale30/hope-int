"use client";

import { useMemo, useState } from "react";
import { Clock, Download, HandCoins, HeartHandshake, Repeat, RefreshCcw, TrendingUp, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, EmptyState, ErrorState, PageSkeleton, PageHeader, StatCard } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { useMeta } from "../../hooks/useMeta";
import { useFormat } from "../../i18n/format";
import { adminApi } from "../../services";
import { useErrorMessage } from "../../i18n/errors";
import { saveBlob } from "../../utils/format";
import { useLabels } from "../../utils/labels";
import { useAlerts } from "../../utils/alerts";
import { PERMISSIONS as P } from "../../utils/rbac";
import { fillMonths, formatEur, providerLabel, recentYears, todayStamp, toEur } from "./parts-b/finance";
import { InlineSelect, MonthlyChart, MonthTable, ShareTable } from "./parts-b/widgets";

const CURRENCIES = ["eur", "xaf"];

// Compteurs renvoyes par le rapprochement, dans l'ordre d'affichage.
const RECONCILE_COUNTERS = ["checked", "succeeded", "recovered", "review", "failed", "abandoned", "errors"];

function ReconcilePanel({ providers, onDone }) {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.finance.reconcile");
  const { confirmAction, showError, toast } = useAlerts();
  const f = useFormat();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const noProvider = !providers.stripe && !providers.mobileMoney;

  const run = async () => {
    const ok = await confirmAction(t("confirmTitle"), t("confirmText"), t("confirm"));
    if (!ok) return;
    setRunning(true);
    try {
      const summary = await adminApi.reconcile();
      setResult(summary);
      onDone();
      toast(summary.checked ? t("done") : t("nothing"));
    } catch (err) {
      showError(t("failed"), getErrorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="adm-reconcile-title">
      <div className="panel__head">
        <div>
          <h2 id="adm-reconcile-title" className="panel__title">{t("title")}</h2>
          <p className="panel__desc">{t("description")}</p>
        </div>
        <Button icon={RefreshCcw} loading={running} onClick={run}>{t("run")}</Button>
      </div>
      {noProvider && <Alert tone="warning" title={t("noProviderTitle")}>{t("noProviderText")}</Alert>}
      {result && (
        <>
          <div className="adm-reconcile" aria-live="polite">
            {RECONCILE_COUNTERS.filter((key) => result[key] !== undefined).map((key) => (
              <div key={key}>
                <strong>{f.number(result[key])}</strong>
                <span>{t(`counters.${key}`, { count: Number(result[key]) || 0 })}</span>
              </div>
            ))}
          </div>
          {Number(result.review) > 0 && (
            <Alert tone="warning" title={t("reviewTitle", { count: Number(result.review) })}>
              {t("reviewText")}
            </Alert>
          )}
        </>
      )}
    </section>
  );
}

function FinanceView() {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.finance");
  const tCommon = useTranslations("adminOps.common");
  const f = useFormat();
  const labels = useLabels();
  const { showError, toast } = useAlerts();
  const { meta } = useMeta();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState(false);
  const { data, loading, error, reload } = useAsync(() => adminApi.financeSummary(year || undefined), [year]);

  const yearOptions = [
    ...recentYears().map((value) => ({ value: String(value), label: String(value) })),
    { value: "", label: t("allYears") },
  ];
  // Variables ICU des libelles dependant de la periode (annee choisie ou depuis le debut).
  const period = { mode: year ? "year" : "all", year: year || "" };

  const months = useMemo(() => fillMonths(data?.byMonth, year), [data, year]);

  const providerRows = (data?.byProvider || []).map((row) => ({
    key: `${row.provider}-${row.method}`,
    label: providerLabel(labels, row.provider, row.method),
    count: row.count,
    value: row.amountEur,
  }));
  const currencyRows = (data?.byCurrency || []).map((row) => ({
    key: row.currency,
    label: CURRENCIES.includes(row.currency) ? t(`currencies.${row.currency}`) : String(row.currency).toUpperCase(),
    sub: row.currency === "xaf" ? t("eurEquivalent", { amount: formatEur(f, toEur(row.amount, "xaf", meta.xafPerEur)) }) : undefined,
    count: row.count,
    value: toEur(row.amount, row.currency, meta.xafPerEur),
    display: f.money(row.amount, row.currency),
  }));
  const projectRows = (data?.byProject || []).map((row) => ({
    key: row.projectId ?? "general",
    label: row.projectId ? row.title : t("generalFund"),
    sub: row.projectId ? undefined : t("generalFundHint"),
    count: row.count,
    value: row.amountEur,
  }));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = { status: "succeeded", ...(year ? { from: `${year}-01-01`, to: `${year}-12-31` } : {}) };
      const blob = await adminApi.exportDonations(params);
      saveBlob(blob, `dons-hope-${year || "tout"}-${todayStamp()}.csv`);
      toast(tCommon("exported"));
    } catch (err) {
      showError(tCommon("exportFailed"), getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <InlineSelect label={t("period")} value={year} onChange={setYear} options={yearOptions} />
            <Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv}>
              {t("export")}
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading || !data ? (
        <PageSkeleton variant="dashboard" label={t("loading")} />
      ) : (
        <>
          <div className="admin-grid-stats">
            <StatCard label={t("stats.total")} value={formatEur(f, data.totalEur)} hint={t("stats.totalHint", period)} icon={HandCoins} />
            <StatCard label={t("stats.count")} value={f.number(data.count)} icon={HeartHandshake} tone="info" />
            <StatCard label={t("stats.donors")} value={f.number(data.donors)} hint={t("stats.donorsHint")} icon={Users} tone="accent" />
            <StatCard label={t("stats.average")} value={formatEur(f, data.averageEur)} icon={TrendingUp} tone="info" />
            <StatCard label={t("stats.recurring")} value={f.number(data.recurringDonors)} hint={t("stats.recurringHint")} icon={Repeat} />
            <StatCard
              label={t("stats.pending")}
              value={f.number(data.pendingCount)}
              hint={t("stats.pendingHint")}
              icon={Clock}
              tone="warning"
            />
          </div>

          {data.count === 0 ? (
            <div className="panel" style={{ marginBottom: 24 }}>
              <EmptyState icon={HandCoins} title={t("empty.title", period)} description={t("empty.text")} />
            </div>
          ) : (
            <>
              <section className="panel" style={{ marginBottom: 24 }} aria-labelledby="adm-month-title">
                <div className="panel__head">
                  <div>
                    <h2 id="adm-month-title" className="panel__title">{t("monthly.title")}</h2>
                    <p className="panel__desc">{t("monthly.description", period)}</p>
                  </div>
                </div>
                <MonthlyChart months={months} />
                <details className="adm-details">
                  <summary>{t("monthly.details")}</summary>
                  <MonthTable months={months} />
                </details>
              </section>

              <div className="admin-panels adm-panels-wide">
                <section className="panel" aria-labelledby="adm-provider-title">
                  <div className="panel__head">
                    <h2 id="adm-provider-title" className="panel__title">{t("byProvider.title")}</h2>
                  </div>
                  <ShareTable rows={providerRows} labelHeader={t("byProvider.header")} caption={t("byProvider.caption")} />
                </section>
                <section className="panel" aria-labelledby="adm-currency-title">
                  <div className="panel__head">
                    <div>
                      <h2 id="adm-currency-title" className="panel__title">{t("byCurrency.title")}</h2>
                      <p className="panel__desc">{t("byCurrency.description")}</p>
                    </div>
                  </div>
                  <ShareTable
                    rows={currencyRows}
                    labelHeader={t("byCurrency.header")}
                    valueHeader={t("byCurrency.amount")}
                    caption={t("byCurrency.caption")}
                  />
                </section>
              </div>

              <section className="panel" style={{ marginBottom: 24 }} aria-labelledby="adm-project-title">
                <div className="panel__head">
                  <div>
                    <h2 id="adm-project-title" className="panel__title">{t("byProject.title")}</h2>
                    <p className="panel__desc">{t("byProject.description")}</p>
                  </div>
                </div>
                <ShareTable rows={projectRows} labelHeader={t("byProject.header")} caption={t("byProject.caption")} />
              </section>
            </>
          )}

          <p className="adm-selection-note" style={{ marginTop: 0 }}>
            {t("rateNote", { rate: f.number(meta.xafPerEur, { maximumFractionDigits: 3 }) })}
          </p>
        </>
      )}

      <ReconcilePanel providers={meta.providers} onDone={reload} />
    </>
  );
}

export default function Finance() {
  return (
    <RequireAuth permission={P.MANAGE_FINANCE}>
      <FinanceView />
    </RequireAuth>
  );
}
