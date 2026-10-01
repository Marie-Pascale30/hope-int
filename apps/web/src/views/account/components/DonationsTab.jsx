"use client";

import { useState } from "react";
import { CalendarHeart, Download, FolderHeart, HandHeart, Heart, Receipt } from "lucide-react";
import { Button, Card, DataTable, EmptyState, ErrorState, LoadingState, StatCard, StatusBadge } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { useMeta } from "../../../hooks/useMeta";
import { paymentApi } from "../../../services";
import { getErrorMessage } from "../../../services/api";
import { confirmAction, showError, toast } from "../../../utils/alerts";
import { formatDate, formatMoney, formatShortDate } from "../../../utils/format";
import { FREQUENCY, PAYMENT_METHOD, PAYMENT_STATUS, SUBSCRIPTION_STATUS, statusOf } from "../../../utils/labels";

const ENDED = ["canceled"];

const COLUMNS = [
  {
    key: "created_at",
    header: "Date",
    sortable: true,
    sortValue: (row) => new Date(row.paid_at || row.created_at).getTime(),
    render: (row) => formatShortDate(row.paid_at || row.created_at),
  },
  {
    key: "amount",
    header: "Montant",
    className: "num",
    render: (row) => <strong>{formatMoney(row.amount, row.currency)}</strong>,
  },
  {
    key: "project_title",
    header: "Affectation",
    render: (row) => row.project_title || "Là où c’est le plus utile",
  },
  {
    key: "method",
    header: "Moyen",
    render: (row) => (
      <span className="acc-cell">
        {PAYMENT_METHOD[row.method] || row.method}
        <small>{FREQUENCY[row.frequency] || row.frequency}</small>
      </span>
    ),
  },
  { key: "status", header: "Statut", render: (row) => <StatusBadge status={statusOf(PAYMENT_STATUS, row.status)} /> },
  {
    key: "receipt",
    header: "Reçu",
    render: (row) =>
      row.status === "succeeded" && row.receipt_token ? (
        <Button
          href={paymentApi.receiptPdfUrl(row.receipt_token)}
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          variant="secondary"
          icon={Download}
          aria-label={`Télécharger le reçu ${row.receipt_number || ""} (PDF)`}
        >
          PDF
        </Button>
      ) : (
        <span className="muted">—</span>
      ),
  },
];

function SubscriptionCard({ subscription, onStopped }) {
  const [stopping, setStopping] = useState(false);
  const status = statusOf(SUBSCRIPTION_STATUS, subscription.status);
  const ended = ENDED.includes(subscription.status);

  const stop = async () => {
    const ok = await confirmAction(
      "Arrêter ce don mensuel ?",
      `Plus aucun prélèvement de ${formatMoney(subscription.amount, subscription.currency)} ne sera effectué. Les dons déjà versés restent acquis au projet.`,
      "Arrêter le don mensuel",
      { danger: true }
    );
    if (!ok) return;
    setStopping(true);
    try {
      await paymentApi.cancelSubscription(subscription.id);
      toast("Don mensuel arrêté");
      onStopped();
    } catch (err) {
      showError("Arrêt impossible", getErrorMessage(err));
    } finally {
      setStopping(false);
    }
  };

  return (
    <Card className="acc-sub">
      <span className="acc-sub__icon"><CalendarHeart aria-hidden="true" /></span>
      <div className="acc-sub__body">
        <strong className="acc-sub__amount">{formatMoney(subscription.amount, subscription.currency)} / mois</strong>
        <span>{subscription.project_title || "Là où c’est le plus utile"}</span>
        <span className="muted">Depuis le {formatDate(subscription.started_at)}</span>
      </div>
      <div className="acc-sub__side">
        <StatusBadge status={status} />
        {!ended && (
          <Button size="sm" variant="ghost" onClick={stop} loading={stopping}>
            Arrêter
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function DonationsTab() {
  const { meta } = useMeta();
  const { data, loading, error, reload } = useAsync(() => paymentApi.mine(), []);

  if (loading && !data) return <LoadingState label="Chargement de vos dons…" />;
  if (error && !data) return <ErrorState message={getErrorMessage(error)} onRetry={reload} />;

  const payments = data?.payments || [];
  const subscriptions = data?.subscriptions || [];

  if (!payments.length) {
    return (
      <EmptyState
        icon={HandHeart}
        title="Vous n’avez pas encore fait de don depuis ce compte"
        description="Votre premier don apparaîtra ici avec son reçu téléchargeable. 25 € suffisent à former une commerçante à la gestion."
        action={<Button href="/don" variant="accent" icon={Heart}>Faire un don</Button>}
      />
    );
  }

  const succeeded = payments.filter((payment) => payment.status === "succeeded");
  const totals = succeeded.reduce((acc, payment) => {
    acc[payment.currency] = (acc[payment.currency] || 0) + Number(payment.amount);
    return acc;
  }, {});
  const totalEur = (totals.eur || 0) + (totals.xaf || 0) / meta.xafPerEur;
  const breakdown = Object.entries(totals).map(([currency, amount]) => formatMoney(amount, currency)).join(" + ");
  const projects = new Set(succeeded.map((payment) => payment.project_id || "general"));
  const last = succeeded[0];

  return (
    <div className="stack acc-tab">
      <div className="grid grid--4">
        <StatCard
          label="Total donné"
          value={formatMoney(Math.round(totalEur))}
          hint={totals.xaf ? `${breakdown} (équivalent en euros)` : "Merci pour votre fidélité"}
          icon={HandHeart}
          tone="accent"
        />
        <StatCard label="Dons réussis" value={succeeded.length} hint={`${payments.length} au total`} icon={Receipt} />
        <StatCard label="Projets soutenus" value={projects.size} icon={FolderHeart} tone="info" />
        <StatCard label="Dernier don" value={last ? formatShortDate(last.paid_at || last.created_at) : "—"} icon={CalendarHeart} />
      </div>

      {subscriptions.length > 0 && (
        <section className="stack" aria-labelledby="acc-subs-title">
          <div className="row row--between">
            <h2 id="acc-subs-title" className="acc-section-title">Dons mensuels</h2>
          </div>
          {subscriptions.map((subscription) => (
            <SubscriptionCard key={subscription.id} subscription={subscription} onStopped={reload} />
          ))}
          {subscriptions.some((subscription) => subscription.status === "unknown") && (
            <p className="muted acc-small">
              Le statut de certains dons mensuels ne peut pas être vérifié pour le moment auprès de notre prestataire de paiement.
            </p>
          )}
        </section>
      )}

      <section className="stack" aria-labelledby="acc-history-title">
        <div className="row row--between">
          <h2 id="acc-history-title" className="acc-section-title">Historique</h2>
          <Button href="/don" size="sm" variant="accent" icon={Heart}>Nouveau don</Button>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={payments}
          pageSize={10}
          initialSort={{ key: "created_at", dir: "desc" }}
          emptyTitle="Aucun don"
        />
      </section>
    </div>
  );
}
