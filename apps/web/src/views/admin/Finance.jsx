"use client";

import "../../styles/admin-b.css";
import { useMemo, useState } from "react";
import { Clock, Download, HandCoins, HeartHandshake, Repeat, RefreshCcw, TrendingUp, Users } from "lucide-react";
import { Alert, Button, EmptyState, ErrorState, LoadingState, PageHeader, StatCard } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { useMeta } from "../../hooks/useMeta";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatMoney, formatNumber, saveBlob } from "../../utils/format";
import { confirmAction, showError, toast } from "../../utils/alerts";
import { PERMISSIONS as P } from "../../utils/rbac";
import { fillMonths, formatEur, providerLabel, recentYears, todayStamp, toEur } from "./parts-b/finance";
import { InlineSelect, MonthlyChart, MonthTable, ShareTable } from "./parts-b/widgets";

const CURRENCY_LABELS = { eur: "Euro (EUR)", xaf: "Franc CFA (XAF)" };

function ReconcilePanel({ providers, onDone }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const noProvider = !providers.stripe && !providers.mobileMoney;

  const run = async () => {
    const ok = await confirmAction(
      "Rapprocher les paiements en attente ?",
      "Les dons en attente depuis plus de 15 minutes seront vérifiés auprès des prestataires. Ceux restés sans réponse depuis plus de 24 heures seront clôturés comme abandonnés.",
      "Lancer le rapprochement"
    );
    if (!ok) return;
    setRunning(true);
    try {
      const summary = await adminApi.reconcile();
      setResult(summary);
      onDone();
      toast(summary.checked ? "Rapprochement terminé" : "Aucun paiement à rapprocher");
    } catch (err) {
      showError("Rapprochement impossible", getErrorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="admb-reconcile-title">
      <div className="panel__head">
        <div>
          <h2 id="admb-reconcile-title" className="panel__title">Rapprochement des paiements</h2>
          <p className="panel__desc">
            Un don peut rester « en attente » si le donateur a fermé la page avant la confirmation. Le rapprochement relit
            leur statut chez le prestataire (Stripe pour la carte, Notch Pay ou Flutterwave pour le Mobile Money), valide ceux qui ont abouti (le reçu part alors automatiquement) et
            clôture ceux abandonnés depuis plus de 24 heures.
          </p>
        </div>
        <Button icon={RefreshCcw} loading={running} onClick={run}>Rapprocher les paiements en attente</Button>
      </div>
      {noProvider && (
        <Alert tone="warning" title="Prestataires non configurés">
          Aucun prestataire de paiement n’est encore relié au serveur : seuls les paiements abandonnés seront clôturés.
        </Alert>
      )}
      {result && (
        <div className="admb-reconcile" aria-live="polite">
          <div><strong>{result.checked}</strong><span>vérifié(s)</span></div>
          <div><strong>{result.succeeded}</strong><span>validé(s)</span></div>
          <div><strong>{result.failed}</strong><span>échoué(s)</span></div>
          <div><strong>{result.abandoned}</strong><span>abandonné(s)</span></div>
          <div><strong>{result.errors}</strong><span>erreur(s) de lecture</span></div>
        </div>
      )}
    </section>
  );
}

function FinanceView() {
  const { meta } = useMeta();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState(false);
  const { data, loading, error, reload } = useAsync(() => adminApi.financeSummary(year || undefined), [year]);

  const yearOptions = [
    ...recentYears().map((value) => ({ value: String(value), label: String(value) })),
    { value: "", label: "Toutes les années" },
  ];
  const periodLabel = year ? `en ${year}` : "depuis le début";

  const months = useMemo(() => fillMonths(data?.byMonth, year), [data, year]);

  const providerRows = (data?.byProvider || []).map((row) => ({
    key: `${row.provider}-${row.method}`,
    label: providerLabel(row.provider, row.method),
    count: row.count,
    value: row.amountEur,
  }));
  const currencyRows = (data?.byCurrency || []).map((row) => ({
    key: row.currency,
    label: CURRENCY_LABELS[row.currency] || row.currency.toUpperCase(),
    sub: row.currency === "xaf" ? `soit ${formatEur(toEur(row.amount, "xaf", meta.xafPerEur))}` : undefined,
    count: row.count,
    value: toEur(row.amount, row.currency, meta.xafPerEur),
    display: formatMoney(row.amount, row.currency),
  }));
  const projectRows = (data?.byProject || []).map((row) => ({
    key: row.projectId ?? "general",
    label: row.title,
    sub: row.projectId ? undefined : "Dons sans affectation",
    count: row.count,
    value: row.amountEur,
  }));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = { status: "succeeded", ...(year ? { from: `${year}-01-01`, to: `${year}-12-31` } : {}) };
      const blob = await adminApi.exportDonations(params);
      saveBlob(blob, `dons-hope-${year || "tout"}-${todayStamp()}.csv`);
      toast("Export CSV téléchargé");
    } catch (err) {
      showError("Export impossible", getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Dons"
        title="Finance"
        description="Bilan des dons réussis, répartition par moyen de paiement et par affectation, rapprochement des paiements."
        actions={
          <>
            <InlineSelect label="Période" value={year} onChange={setYear} options={yearOptions} />
            <Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv}>
              Exporter les dons réussis (CSV)
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState label="Calcul du bilan…" />
      ) : (
        <>
          <div className="admin-grid-stats">
            <StatCard label="Total collecté" value={formatEur(data.totalEur)} hint={`Dons réussis ${periodLabel}`} icon={HandCoins} />
            <StatCard label="Nombre de dons" value={formatNumber(data.count)} icon={HeartHandshake} tone="info" />
            <StatCard label="Donateurs" value={formatNumber(data.donors)} hint="Personnes distinctes" icon={Users} tone="accent" />
            <StatCard label="Don moyen" value={formatEur(data.averageEur)} icon={TrendingUp} tone="info" />
            <StatCard label="Donateurs mensuels" value={formatNumber(data.recurringDonors)} hint="Au moins un don mensuel" icon={Repeat} />
            <StatCard
              label="Paiements en attente"
              value={formatNumber(data.pendingCount)}
              hint="Toutes périodes confondues"
              icon={Clock}
              tone="warning"
            />
          </div>

          {data.count === 0 ? (
            <div className="panel" style={{ marginBottom: 24 }}>
              <EmptyState
                icon={HandCoins}
                title={`Aucun don réussi ${periodLabel}`}
                description="Choisissez une autre période pour consulter le bilan."
              />
            </div>
          ) : (
            <>
              <section className="panel" style={{ marginBottom: 24 }} aria-labelledby="admb-month-title">
                <div className="panel__head">
                  <div>
                    <h2 id="admb-month-title" className="panel__title">Montant collecté par mois</h2>
                    <p className="panel__desc">En euros, dons réussis {periodLabel}.</p>
                  </div>
                </div>
                <MonthlyChart months={months} />
                <details className="admb-details">
                  <summary>Voir les valeurs mois par mois</summary>
                  <MonthTable months={months} />
                </details>
              </section>

              <div className="admin-panels admb-panels-wide">
                <section className="panel" aria-labelledby="admb-provider-title">
                  <div className="panel__head">
                    <h2 id="admb-provider-title" className="panel__title">Par moyen de paiement</h2>
                  </div>
                  <ShareTable rows={providerRows} labelHeader="Moyen" caption="Répartition par moyen de paiement" />
                </section>
                <section className="panel" aria-labelledby="admb-currency-title">
                  <div className="panel__head">
                    <div>
                      <h2 id="admb-currency-title" className="panel__title">Par devise</h2>
                      <p className="panel__desc">Montants dans la devise d&apos;origine ; part calculée en équivalent euros.</p>
                    </div>
                  </div>
                  <ShareTable rows={currencyRows} labelHeader="Devise" valueHeader="Montant" caption="Répartition par devise" />
                </section>
              </div>

              <section className="panel" style={{ marginBottom: 24 }} aria-labelledby="admb-project-title">
                <div className="panel__head">
                  <div>
                    <h2 id="admb-project-title" className="panel__title">Par affectation</h2>
                    <p className="panel__desc">Projets et campagnes soutenus ; le fonds général regroupe les dons libres.</p>
                  </div>
                </div>
                <ShareTable rows={projectRows} labelHeader="Affectation" caption="Répartition par affectation" />
              </section>
            </>
          )}

          <p className="admb-note" style={{ marginTop: 0 }}>
            Les montants en francs CFA sont convertis en euros à la parité fixe de 1 € = {formatNumber(meta.xafPerEur, { maximumFractionDigits: 3 })} FCFA.
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
