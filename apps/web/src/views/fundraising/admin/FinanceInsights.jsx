"use client";

// Indicateurs de collecte affiches dans Finance : dons mensuels (MRR, attrition), engagements
// Mobile Money, dons hors ligne a valider, ventilation par source, recapitulatifs fiscaux annuels.
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarHeart, HandCoins, Mail, Repeat, TrendingDown, AlertTriangle } from "lucide-react";
import { Alert, Button, ErrorState, LoadingState, StatCard } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { fundraisingAdminApi } from "../../../services/fundraising";
import { useFormat } from "../../../i18n/format";
import { useErrorMessage } from "../../../i18n/errors";
import { useAlerts } from "../../../utils/alerts";
import { ShareTable } from "../../admin/components/widgets";

// Libelle d'une source : sources connues traduites, sinon la valeur nettoyee telle quelle.
const KNOWN_SOURCES = ["partage-whatsapp", "partage-facebook", "partage-lien", "partage-natif", "relance", "engagement", "collecte", "hors-ligne"];

function AnnualSummaries({ status, onDone }) {
  const t = useTranslations("fundraising.admin.insights.annual");
  const errorText = useErrorMessage();
  const { confirmAction, showError, toast } = useAlerts();
  const [running, setRunning] = useState(false);
  if (!status) return null;

  const send = async () => {
    const ok = await confirmAction(t("confirmTitle", { year: status.year }), t("confirmText", { count: status.recipients }), t("send"));
    if (!ok) return;
    setRunning(true);
    try {
      let result;
      // Un lot par appel : on poursuit tant qu'il reste des comptes (borne de securite).
      for (let round = 0; round < 40; round += 1) {
        result = await fundraisingAdminApi.sendAnnualSummaries(status.year);
        if (!result.remaining || (!result.sent && result.failed)) break;
      }
      toast(t("done"));
      onDone();
    } catch (err) {
      showError(t("error"), errorText(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="fr-annual-title" style={{ marginBottom: 24 }}>
      <div className="panel__head">
        <div>
          <h2 id="fr-annual-title" className="panel__title">{t("title", { year: status.year })}</h2>
          <p className="panel__desc">{t("description")}</p>
        </div>
        <Button icon={Mail} loading={running} disabled={status.completed || !status.recipients} onClick={send}>
          {t("send")}
        </Button>
      </div>
      <p style={{ margin: 0 }}>
        {status.completed
          ? t("completed", { sent: status.sent })
          : t("progress", { sent: status.sent, recipients: status.recipients })}
      </p>
    </section>
  );
}

export default function FinanceInsights({ year }) {
  const t = useTranslations("fundraising.admin.insights");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { data, loading, error, reload } = useAsync(() => fundraisingAdminApi.insights(year || undefined), [year]);

  if (error) return <ErrorState message={errorText(error)} onRetry={reload} />;
  if (loading && !data) return <LoadingState label={t("loading")} />;
  if (!data) return null;

  const { recurring, pledges } = data;
  const sourceRows = data.bySource.map((row) => ({
    key: row.source || "direct",
    label: !row.source ? t("sources.direct") : KNOWN_SOURCES.includes(row.source) ? t(`sources.${row.source}`) : row.source,
    sub: row.source && KNOWN_SOURCES.includes(row.source) ? row.source : undefined,
    count: row.count,
    value: row.amountEur,
  }));

  return (
    <>
      {data.offlinePending > 0 && (
        <Alert tone="warning" title={t("offlinePendingTitle", { count: data.offlinePending })}>
          {t.rich("offlinePendingText", { link: (chunks) => <Link href="/admin/dons-hors-ligne">{chunks}</Link> })}
        </Alert>
      )}

      <section className="panel" aria-labelledby="fr-recurring-title" style={{ marginBottom: 24 }}>
        <div className="panel__head">
          <div>
            <h2 id="fr-recurring-title" className="panel__title">{t("recurring.title")}</h2>
            <p className="panel__desc">{t("recurring.description")}</p>
          </div>
        </div>
        <div className="admin-grid-stats">
          <StatCard label={t("recurring.mrr")} value={f.money(recurring.mrrEur, "eur")} hint={t("recurring.mrrHint")} icon={Repeat} />
          <StatCard label={t("recurring.active")} value={f.number(recurring.active)} icon={CalendarHeart} tone="info" />
          <StatCard label={t("recurring.pastDue")} value={f.number(recurring.pastDue)} hint={t("recurring.pastDueHint")} icon={AlertTriangle} tone="warning" />
          <StatCard
            label={t("recurring.churn")}
            value={`${f.number(recurring.churnRate30)} %`}
            hint={t("recurring.churnHint", { count: recurring.canceledLast30 })}
            icon={TrendingDown}
            tone="accent"
          />
          <StatCard
            label={t("pledges.active")}
            value={f.number(pledges.active)}
            hint={t("pledges.monthly", { amount: f.money(pledges.monthlyXaf, "xaf") })}
            icon={HandCoins}
          />
          <StatCard
            label={t("pledges.regularity")}
            value={pledges.rate === null ? "—" : `${f.number(pledges.rate)} %`}
            hint={t("pledges.regularityHint", { paid: pledges.paid, missed: pledges.missed })}
            icon={CalendarHeart}
            tone="info"
          />
        </div>
      </section>

      <section className="panel" aria-labelledby="fr-source-title" style={{ marginBottom: 24 }}>
        <div className="panel__head">
          <div>
            <h2 id="fr-source-title" className="panel__title">{t("bySource.title")}</h2>
            <p className="panel__desc">{t("bySource.description")}</p>
          </div>
        </div>
        {sourceRows.length ? (
          <ShareTable rows={sourceRows} labelHeader={t("bySource.header")} caption={t("bySource.caption")} />
        ) : (
          <p className="muted">{t("bySource.empty")}</p>
        )}
      </section>

      <AnnualSummaries status={data.annualSummaries} onDone={reload} />
    </>
  );
}
