"use client";

import "../../styles/admin-b.css";
import { useCallback, useMemo, useState } from "react";
import { Clock, Download, FileDown, HandCoins, HeartHandshake, RotateCcw, Users } from "lucide-react";
import {
  Badge, Button, DataTable, ErrorState, Input, LoadingState, Modal, PageHeader, Select, StatCard, StatusBadge,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useMeta } from "../../hooks/useMeta";
import { adminApi, paymentApi, publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatDateTime, formatMoney, formatNumber, saveBlob } from "../../utils/format";
import { FREQUENCY, PAYMENT_METHOD, PAYMENT_STATUS, statusOf } from "../../utils/labels";
import { showError, toast } from "../../utils/alerts";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import { cleanParams, formatEur, PROVIDER_LABELS, providerLabel, todayStamp, toEur } from "./parts-b/finance";

const EMPTY_FILTERS = { status: "", provider: "", projectId: "", from: "", to: "" };

const STATUS_OPTIONS = Object.entries(PAYMENT_STATUS).map(([value, { label }]) => ({ value, label }));
const PROVIDER_OPTIONS = [
  { value: "stripe", label: "Carte bancaire (Stripe)" },
  { value: "notchpay", label: "Mobile Money (Notch Pay)" },
  { value: "flutterwave", label: "Mobile Money (Flutterwave)" },
];

const donationDate = (row) => row.paid_at || row.created_at;

function DonationDetail({ donation, xafPerEur, onClose }) {
  if (!donation) return null;
  const isXaf = donation.currency === "xaf";
  const hasReceipt = donation.status === "succeeded" && donation.receipt_token && donation.receipt_number;

  return (
    <Modal
      open
      title={`Don n° ${donation.id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          {hasReceipt && (
            <Button
              href={paymentApi.receiptPdfUrl(donation.receipt_token)}
              target="_blank"
              rel="noopener noreferrer"
              icon={FileDown}
            >
              Reçu fiscal (PDF)
            </Button>
          )}
        </>
      }
    >
      <dl className="dl">
        <dt>Statut</dt>
        <dd><StatusBadge status={statusOf(PAYMENT_STATUS, donation.status)} /></dd>
        <dt>Montant</dt>
        <dd>
          <strong>{formatMoney(donation.amount, donation.currency)}</strong>
          {isXaf && <span className="muted"> · soit {formatEur(toEur(donation.amount, "xaf", xafPerEur))}</span>}
        </dd>
        <dt>Fréquence</dt>
        <dd>{FREQUENCY[donation.frequency] || donation.frequency}</dd>
        <dt>Moyen de paiement</dt>
        <dd>{providerLabel(donation.provider, donation.method)}</dd>
        <dt>Donateur</dt>
        <dd>{donation.donor_name || "—"}</dd>
        <dt>Email</dt>
        <dd>{donation.donor_email ? <a href={`mailto:${donation.donor_email}`}>{donation.donor_email}</a> : "—"}</dd>
        <dt>Compte membre</dt>
        <dd>{donation.user_id ? `Oui (compte n° ${donation.user_id})` : "Don effectué sans compte"}</dd>
        <dt>Affectation</dt>
        <dd>
          {donation.project_title || "Fonds général"}
          {donation.project_region && <span className="muted"> · {donation.project_region}</span>}
        </dd>
        <dt>Créé le</dt>
        <dd>{formatDateTime(donation.created_at)}</dd>
        <dt>Payé le</dt>
        <dd>{donation.paid_at ? formatDateTime(donation.paid_at) : "Pas encore confirmé"}</dd>
        <dt>N° de reçu</dt>
        <dd>{donation.receipt_number || "Émis une fois le paiement confirmé"}</dd>
        <dt>Référence prestataire</dt>
        <dd><code>{donation.transaction_id || "—"}</code></dd>
        {donation.subscription_id && (
          <>
            <dt>Abonnement</dt>
            <dd><code>{donation.subscription_id}</code></dd>
          </>
        )}
      </dl>
    </Modal>
  );
}

function DonationsView() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const xafPerEur = meta.xafPerEur;
  const canExport = can(user, P.MANAGE_FINANCE);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const closeDetail = useCallback(() => setSelected(null), []);

  const params = useMemo(() => cleanParams(filters), [filters]);
  const { data, loading, error, reload } = useAsync(() => adminApi.donations(params), [params]);
  const { data: projects } = useAsync(() => publicApi.listContent("projects"), []);

  const donations = useMemo(() => data || [], [data]);
  const totals = useMemo(() => {
    const succeeded = donations.filter((row) => row.status === "succeeded");
    const pending = donations.filter((row) => row.status === "pending");
    return {
      amountEur: succeeded.reduce((sum, row) => sum + toEur(row.amount, row.currency, xafPerEur), 0),
      succeeded: succeeded.length,
      pending: pending.length,
      pendingEur: pending.reduce((sum, row) => sum + toEur(row.amount, row.currency, xafPerEur), 0),
      donors: new Set(succeeded.map((row) => row.donor_email || `user:${row.user_id}`)).size,
    };
  }, [donations, xafPerEur]);

  const setFilter = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }));
  const hasFilters = Object.keys(params).length > 0;
  const periodInvalid = filters.from && filters.to && filters.to < filters.from;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportDonations(params);
      saveBlob(blob, `dons-hope-${todayStamp()}.csv`);
      toast("Export CSV téléchargé");
    } catch (err) {
      showError("Export impossible", getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (row) => new Date(donationDate(row)).getTime(),
      render: (row) => <span className="admb-nowrap">{formatDateTime(donationDate(row))}</span>,
    },
    {
      key: "donor",
      header: "Donateur",
      sortable: true,
      sortValue: (row) => (row.donor_name || "").toLowerCase(),
      render: (row) => (
        <div className="cell-main">
          <strong>{row.donor_name || "—"}</strong>
          <span>{row.donor_email}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Montant",
      className: "num",
      sortable: true,
      sortValue: (row) => toEur(row.amount, row.currency, xafPerEur),
      render: (row) => <strong className="admb-nowrap">{formatMoney(row.amount, row.currency)}</strong>,
    },
    {
      key: "project",
      header: "Affectation",
      render: (row) => row.project_title || <span className="muted">Fonds général</span>,
    },
    {
      key: "method",
      header: "Moyen",
      render: (row) => (
        <div className="cell-main">
          <strong>{PAYMENT_METHOD[row.method] || row.method}</strong>
          <span>{PROVIDER_LABELS[row.provider] || row.provider}</span>
        </div>
      ),
    },
    {
      key: "frequency",
      header: "Fréquence",
      render: (row) => (row.frequency === "monthly" ? <Badge tone="brand">Mensuel</Badge> : FREQUENCY.once),
    },
    {
      key: "status",
      header: "Statut",
      sortable: true,
      render: (row) => <StatusBadge status={statusOf(PAYMENT_STATUS, row.status)} />,
    },
    {
      key: "receipt_number",
      header: "N° reçu",
      render: (row) => (row.receipt_number ? <span className="admb-nowrap">{row.receipt_number}</span> : "—"),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Dons"
        title="Dons reçus"
        description="Suivez chaque don, son affectation et son reçu. Cliquez sur une ligne pour voir le détail."
        actions={
          canExport && (
            <Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv} disabled={loading || periodInvalid}>
              Exporter en CSV
            </Button>
          )
        }
      />

      <form className="admb-filters" aria-label="Filtrer les dons" onSubmit={(event) => event.preventDefault()}>
        <Select label="Statut" placeholder="Tous les statuts" options={STATUS_OPTIONS} value={filters.status} onChange={setFilter("status")} />
        <Select label="Prestataire" placeholder="Tous" options={PROVIDER_OPTIONS} value={filters.provider} onChange={setFilter("provider")} />
        <Select
          label="Projet"
          placeholder="Tous les projets"
          options={(projects || []).map((project) => ({ value: String(project.id), label: project.title }))}
          value={filters.projectId}
          onChange={setFilter("projectId")}
        />
        <Input label="Du" type="date" value={filters.from} onChange={setFilter("from")} max={filters.to || undefined} />
        <Input
          label="Au"
          type="date"
          value={filters.to}
          onChange={setFilter("to")}
          min={filters.from || undefined}
          error={periodInvalid ? "Doit suivre la date de début" : undefined}
        />
        <div className="admb-filters__actions">
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasFilters}>
            Réinitialiser
          </Button>
        </div>
      </form>

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState label="Chargement des dons…" />
      ) : (
        <>
          <div className="admin-grid-stats">
            <StatCard
              label="Montant réussi"
              value={formatEur(totals.amountEur)}
              hint="Équivalent en euros de la sélection"
              icon={HandCoins}
            />
            <StatCard
              label="Dons dans la sélection"
              value={formatNumber(donations.length)}
              hint={`${formatNumber(totals.succeeded)} réussi(s)`}
              icon={HeartHandshake}
              tone="info"
            />
            <StatCard label="Donateurs distincts" value={formatNumber(totals.donors)} hint="Parmi les dons réussis" icon={Users} tone="accent" />
            <StatCard
              label="En attente"
              value={formatNumber(totals.pending)}
              hint={totals.pending ? `Soit ${formatEur(totals.pendingEur)} à confirmer` : "Aucun paiement à confirmer"}
              icon={Clock}
              tone="warning"
            />
          </div>
          <p className="admb-note">
            Les dons en francs CFA sont convertis à la parité fixe de 1 € = {formatNumber(xafPerEur, { maximumFractionDigits: 3 })} FCFA.
            {donations.length >= 2000 && " Seuls les 2 000 dons les plus récents sont affichés : affinez les filtres."}
          </p>

          <DataTable
            columns={columns}
            rows={donations}
            searchKeys={(row) => `${row.donor_name} ${row.donor_email} ${row.receipt_number || ""} ${row.project_title || ""}`}
            searchPlaceholder="Nom, email, n° de reçu…"
            pageSize={20}
            initialSort={{ key: "date", dir: "desc" }}
            onRowClick={setSelected}
            emptyTitle={hasFilters ? "Aucun don pour ces filtres" : "Aucun don pour le moment"}
            emptyDescription={
              hasFilters
                ? "Élargissez la période ou retirez un filtre pour voir plus de résultats."
                : "Les dons apparaîtront ici dès qu'un donateur aura commencé un paiement."
            }
          />
        </>
      )}

      <DonationDetail donation={selected} xafPerEur={xafPerEur} onClose={closeDetail} />
    </>
  );
}

export default function Donations() {
  return (
    <RequireAuth permission={P.VIEW_DONATIONS}>
      <DonationsView />
    </RequireAuth>
  );
}
