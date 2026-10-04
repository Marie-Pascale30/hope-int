"use client";

import { useMemo, useState } from "react";
import { CalendarHeart, Download, FileText, FolderHeart, HandHeart, Heart, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Card, DataTable, EmptyState, ErrorState, LoadingState, StatCard, StatusBadge } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { useMeta } from "../../../hooks/useMeta";
import { useFormat } from "../../../i18n/format";
import { useLocalePath } from "../../../i18n/navigation";
import { paymentApi } from "../../../services";
import { useAlerts } from "../../../utils/alerts";
import { saveBlob } from "../../../utils/format";
import { useLabels } from "../../../utils/labels";
import { useErrorMessage } from "../../../i18n/errors";

const ENDED = ["canceled"];

// Recu indisponible : message a la place du lien (memes cas que les codes RECEIPT_* de l'API).
// Libelles : account.donations.receiptUnavailable.<statut>.{label,hint}
const RECEIPT_UNAVAILABLE = ["refunded", "disputed", "review"];

const refundedOf = (payment) => Number(payment.refunded_amount) || 0;
const yearOf = (payment) => new Date(payment.paid_at || payment.created_at).getFullYear();

// Message d'erreur d'un telechargement en Blob (le corps JSON de l'erreur arrive lui aussi en Blob).
async function blobErrorMessage(error, errorText) {
  const body = error?.response?.data;
  if (body instanceof Blob) {
    try {
      const parsed = JSON.parse(await body.text());
      if (parsed?.error) return parsed.error;
    } catch {
      // Corps illisible : message generique.
    }
  }
  return errorText(error);
}

function useColumns() {
  const t = useTranslations("account.donations");
  const f = useFormat();
  const labels = useLabels();
  return useMemo(() => [
    {
      key: "created_at",
      header: t("columns.date"),
      sortable: true,
      sortValue: (row) => new Date(row.paid_at || row.created_at).getTime(),
      render: (row) => f.shortDate(row.paid_at || row.created_at),
    },
    {
      key: "amount",
      header: t("columns.amount"),
      className: "num",
      render: (row) =>
        refundedOf(row) > 0 && row.status === "succeeded" ? (
          <span className="acc-cell">
            <strong>{f.money(row.amount, row.currency)}</strong>
            <small>{t("partialRefund", { amount: f.money(refundedOf(row), row.currency) })}</small>
          </span>
        ) : (
          <strong>{f.money(row.amount, row.currency)}</strong>
        ),
    },
    {
      key: "project_title",
      header: t("columns.project"),
      render: (row) => row.project_title || t("general"),
    },
    {
      key: "method",
      header: t("columns.method"),
      render: (row) => (
        <span className="acc-cell">
          {labels.method(row.method)}
          <small>{labels.frequency(row.frequency)}</small>
        </span>
      ),
    },
    { key: "status", header: t("columns.status"), render: (row) => <StatusBadge status={labels.status("paymentStatus", row.status)} /> },
    {
      key: "receipt",
      header: t("columns.receipt"),
      render: (row) =>
        RECEIPT_UNAVAILABLE.includes(row.status) ? (
          <span className="acc-cell acc-receipt-off">
            {t(`receiptUnavailable.${row.status}.label`)}
            <small>{t(`receiptUnavailable.${row.status}.hint`)}</small>
          </span>
        ) : row.status === "succeeded" && row.receipt_token ? (
          <Button
            href={paymentApi.receiptPdfUrl(row.receipt_token)}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            variant="secondary"
            icon={Download}
            aria-label={t("receiptLabel", { number: row.receipt_number || "" })}
          >
            PDF
          </Button>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ], [t, f, labels]);
}

function SubscriptionCard({ subscription, onStopped }) {
  const t = useTranslations("account.donations");
  const f = useFormat();
  const labels = useLabels();
  const { confirmAction, showError, toast } = useAlerts();
  const errorText = useErrorMessage();
  const [stopping, setStopping] = useState(false);
  const status = labels.status("subscriptionStatus", subscription.status);
  const ended = ENDED.includes(subscription.status);
  const amount = f.money(subscription.amount, subscription.currency);

  const stop = async () => {
    const ok = await confirmAction(t("stopTitle"), t("stopText", { amount }), t("stopConfirm"), { danger: true });
    if (!ok) return;
    setStopping(true);
    try {
      await paymentApi.cancelSubscription(subscription.id);
      toast(t("stopped"));
      onStopped();
    } catch (err) {
      showError(t("stopError"), errorText(err));
    } finally {
      setStopping(false);
    }
  };

  return (
    <Card className="acc-sub">
      <span className="acc-sub__icon"><CalendarHeart aria-hidden="true" /></span>
      <div className="acc-sub__body">
        <strong className="acc-sub__amount">{t("perMonth", { amount })}</strong>
        <span>{subscription.project_title || t("general")}</span>
        <span className="muted">{t("since", { date: f.date(subscription.started_at) })}</span>
      </div>
      <div className="acc-sub__side">
        <StatusBadge status={status} />
        {!ended && (
          <Button size="sm" variant="ghost" onClick={stop} loading={stopping}>
            {t("stop")}
          </Button>
        )}
      </div>
    </Card>
  );
}

// Recapitulatifs annuels : un bouton par annee comptant au moins un don confirme.
// Lien direct vers l'API (cookie de session envoye : meme site, Path=/api) ; au clic, le fichier est
// recupere pour pouvoir signaler proprement une annee sans don confirme (404).
function AnnualReceipts({ years }) {
  const t = useTranslations("account.donations.annual");
  const errorText = useErrorMessage();
  const [busyYear, setBusyYear] = useState(null);
  const [message, setMessage] = useState("");

  const download = async (event, year) => {
    event.preventDefault();
    setBusyYear(year);
    setMessage("");
    try {
      const blob = await paymentApi.annualReceipt(year);
      saveBlob(blob, t("file", { year: String(year) }));
    } catch (err) {
      setMessage(err?.response?.status === 404 ? t("notFound", { year: String(year) }) : await blobErrorMessage(err, errorText));
    } finally {
      setBusyYear(null);
    }
  };

  return (
    <section className="stack" aria-labelledby="acc-annual-title">
      <div>
        <h2 id="acc-annual-title" className="acc-section-title">{t("title")}</h2>
        <p className="muted acc-small">{t("description")}</p>
      </div>
      <div className="acc-annual">
        {years.map((year) => (
          <Button
            key={year}
            href={paymentApi.annualReceiptPdfUrl(year)}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            variant="secondary"
            icon={FileText}
            loading={busyYear === year}
            aria-label={t("label", { year: String(year) })}
            onClick={(event) => download(event, year)}
          >
            {t("button", { year: String(year) })}
          </Button>
        ))}
      </div>
      {message && <Alert tone="warning" title={t("errorTitle")}>{message}</Alert>}
    </section>
  );
}

export default function DonationsTab() {
  const t = useTranslations("account.donations");
  const f = useFormat();
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const columns = useColumns();
  const { meta } = useMeta();
  const { data, loading, error, reload } = useAsync(() => paymentApi.mine(), []);

  if (loading && !data) return <LoadingState label={t("loading")} />;
  if (error && !data) return <ErrorState message={errorText(error)} onRetry={reload} />;

  const payments = data?.payments || [];
  const subscriptions = data?.subscriptions || [];

  if (!payments.length) {
    return (
      <EmptyState
        icon={HandHeart}
        title={t("emptyTitle")}
        description={t("emptyText", { amount: f.money(25, "eur") })}
        action={<Button href={lp("/don")} variant="accent" icon={Heart}>{t("donate")}</Button>}
      />
    );
  }

  const succeeded = payments.filter((payment) => payment.status === "succeeded");
  // Total net des remboursements partiels (le don reste "succeeded").
  const totals = succeeded.reduce((acc, payment) => {
    acc[payment.currency] = (acc[payment.currency] || 0) + Number(payment.amount) - refundedOf(payment);
    return acc;
  }, {});
  const totalEur = (totals.eur || 0) + (totals.xaf || 0) / meta.xafPerEur;
  const breakdown = Object.entries(totals).map(([currency, amount]) => f.money(amount, currency)).join(" + ");
  const projects = new Set(succeeded.map((payment) => payment.project_id || "general"));
  const last = succeeded[0];
  const years = [...new Set(succeeded.map(yearOf))].filter(Number.isFinite).sort((a, b) => b - a);

  return (
    <div className="stack acc-tab">
      <div className="grid grid--4">
        <StatCard
          label={t("stats.total")}
          value={f.money(Math.round(totalEur))}
          hint={totals.xaf ? t("stats.totalEquivalent", { breakdown }) : t("stats.totalThanks")}
          icon={HandHeart}
          tone="accent"
        />
        <StatCard
          label={t("stats.succeeded")}
          value={f.number(succeeded.length)}
          hint={t("stats.overall", { count: payments.length })}
          icon={Receipt}
        />
        <StatCard label={t("stats.projects")} value={f.number(projects.size)} icon={FolderHeart} tone="info" />
        <StatCard label={t("stats.last")} value={last ? f.shortDate(last.paid_at || last.created_at) : "—"} icon={CalendarHeart} />
      </div>

      {subscriptions.length > 0 && (
        <section className="stack" aria-labelledby="acc-subs-title">
          <div className="row row--between">
            <h2 id="acc-subs-title" className="acc-section-title">{t("monthlyTitle")}</h2>
          </div>
          {subscriptions.map((subscription) => (
            <SubscriptionCard key={subscription.id} subscription={subscription} onStopped={reload} />
          ))}
          {subscriptions.some((subscription) => subscription.status === "unknown") && (
            <p className="muted acc-small">{t("unknownStatus")}</p>
          )}
        </section>
      )}

      <section className="stack" aria-labelledby="acc-history-title">
        <div className="row row--between">
          <h2 id="acc-history-title" className="acc-section-title">{t("historyTitle")}</h2>
          <Button href={lp("/don")} size="sm" variant="accent" icon={Heart}>{t("newDonation")}</Button>
        </div>
        <DataTable
          columns={columns}
          rows={payments}
          pageSize={10}
          initialSort={{ key: "created_at", dir: "desc" }}
          emptyTitle={t("emptyTable")}
        />
      </section>

      {years.length > 0 && <AnnualReceipts years={years} />}
    </div>
  );
}
