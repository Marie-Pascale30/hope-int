"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Clock, Download, FileDown, HandCoins, HeartHandshake, Mail, RotateCcw, Users, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Alert, Badge, Button, DataTable, ErrorState, Input, PageSkeleton, Modal, PageHeader, Select, StatCard, StatusBadge, Textarea,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useMeta } from "../../hooks/useMeta";
import { useFormat } from "../../i18n/format";
import { adminApi, paymentApi, publicApi } from "../../services";
import { useErrorMessage } from "../../i18n/errors";
import { saveBlob } from "../../utils/format";
import { STATUS_KEYS, useLabels } from "../../utils/labels";
import { useAlerts } from "../../utils/alerts";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import {
  cleanParams, formatEur, netAmount, PROVIDER_KEYS, PROVIDER_METHOD, providerLabel, providerName, todayStamp, toEur,
} from "./parts-b/finance";

const EMPTY_FILTERS = { status: "", provider: "", projectId: "", from: "", to: "" };
const NOTE_MAX = 500;
const LIST_LIMIT = 2000;

const donationDate = (row) => row.paid_at || row.created_at;
const refundedOf = (row) => Number(row.refunded_amount) || 0;

// Don en verification (montant ou devise incoherents) : validation ou rejet manuel.
function ReviewPanel({ donation, onResolved }) {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.donations.review");
  const { confirmAction, showError, toast } = useAlerts();
  const f = useFormat();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  const decide = async (decision) => {
    const approve = decision === "approve";
    const ok = await confirmAction(
      approve ? t("confirmApproveTitle") : t("confirmRejectTitle"),
      approve
        ? t("confirmApproveText", { amount: f.money(donation.amount, donation.currency) })
        : t("confirmRejectText"),
      approve ? t("approve") : t("reject"),
      { danger: !approve }
    );
    if (!ok) return;
    setBusy(decision);
    try {
      const result = await adminApi.reviewDonation(donation.id, decision, note.trim());
      toast(result?.message || (approve ? t("approved") : t("rejected")));
      onResolved(result?.donation);
    } catch (err) {
      showError(t("failed"), getErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="adm-review">
      <Alert tone="warning" title={t("title")}>{t("explain")}</Alert>
      <Textarea
        label={t("noteLabel")}
        rows={2}
        maxLength={NOTE_MAX}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        hint={t("noteHint", { count: note.length, max: NOTE_MAX })}
      />
      <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
        <Button icon={CheckCircle2} loading={busy === "approve"} disabled={Boolean(busy)} onClick={() => decide("approve")}>
          {t("approve")}
        </Button>
        <Button variant="danger" icon={XCircle} loading={busy === "reject"} disabled={Boolean(busy)} onClick={() => decide("reject")}>
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}

function DonationDetail({ donation, xafPerEur, canManage, onClose, onUpdated }) {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.donations.detail");
  const labels = useLabels();
  const f = useFormat();
  const { confirmAction, showError, toast } = useAlerts();
  const [resending, setResending] = useState(false);
  if (!donation) return null;
  const isXaf = donation.currency === "xaf";
  const refunded = refundedOf(donation);
  const hasReceipt = donation.status === "succeeded" && donation.receipt_token && donation.receipt_number;

  const resend = async () => {
    const ok = await confirmAction(
      t("resendConfirmTitle"),
      donation.donor_email ? t("resendConfirmText", { email: donation.donor_email }) : t("resendConfirmNoEmail"),
      t("resend")
    );
    if (!ok) return;
    setResending(true);
    try {
      const result = await adminApi.resendReceipt(donation.id);
      toast(result?.message || t("resent"));
    } catch (err) {
      showError(t("resendFailed"), getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <Modal
      open
      title={t("title", { id: donation.id })}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("close")}</Button>
          {hasReceipt && canManage && (
            <Button variant="secondary" icon={Mail} loading={resending} onClick={resend}>{t("resend")}</Button>
          )}
          {hasReceipt && (
            <Button
              href={paymentApi.receiptPdfUrl(donation.receipt_token)}
              target="_blank"
              rel="noopener noreferrer"
              icon={FileDown}
            >
              {t("receiptPdf")}
            </Button>
          )}
        </>
      }
    >
      {donation.status === "review" && canManage && <ReviewPanel donation={donation} onResolved={onUpdated} />}
      {donation.status === "review" && !canManage && <Alert tone="warning" title={t("reviewTitle")}>{t("reviewReadOnly")}</Alert>}
      {donation.status === "disputed" && <Alert tone="danger" title={t("disputedTitle")}>{t("disputedText")}</Alert>}
      <dl className="dl">
        <dt>{t("status")}</dt>
        <dd><StatusBadge status={labels.status("paymentStatus", donation.status)} /></dd>
        <dt>{t("amount")}</dt>
        <dd>
          <strong>{f.money(donation.amount, donation.currency)}</strong>
          {isXaf && <span className="muted"> · {t("eurEquivalent", { amount: formatEur(f, toEur(donation.amount, "xaf", xafPerEur)) })}</span>}
        </dd>
        {refunded > 0 && (
          <>
            <dt>{t("refunded")}</dt>
            <dd>
              {f.money(refunded, donation.currency)}
              <span className="muted"> · {t("net", { amount: f.money(netAmount(donation), donation.currency) })}</span>
            </dd>
          </>
        )}
        <dt>{t("frequency")}</dt>
        <dd>{labels.frequency(donation.frequency)}</dd>
        <dt>{t("method")}</dt>
        <dd>{providerLabel(labels, donation.provider, donation.method)}</dd>
        <dt>{t("donor")}</dt>
        <dd>{donation.donor_name || "—"}</dd>
        <dt>{t("email")}</dt>
        <dd>{donation.donor_email ? <a href={`mailto:${donation.donor_email}`}>{donation.donor_email}</a> : "—"}</dd>
        <dt>{t("account")}</dt>
        <dd>{donation.user_id ? t("accountYes", { id: donation.user_id }) : t("accountNo")}</dd>
        <dt>{t("allocation")}</dt>
        <dd>
          {donation.project_title || t("generalFund")}
          {donation.project_region && <span className="muted"> · {donation.project_region}</span>}
        </dd>
        <dt>{t("createdAt")}</dt>
        <dd>{f.dateTime(donation.created_at)}</dd>
        <dt>{t("paidAt")}</dt>
        <dd>{donation.paid_at ? f.dateTime(donation.paid_at) : t("notConfirmed")}</dd>
        <dt>{t("receiptNumber")}</dt>
        <dd>{donation.receipt_number || t("receiptPending")}</dd>
        <dt>{t("reference")}</dt>
        <dd><code>{donation.transaction_id || "—"}</code></dd>
        {donation.subscription_id && (
          <>
            <dt>{t("subscription")}</dt>
            <dd><code>{donation.subscription_id}</code></dd>
          </>
        )}
      </dl>
    </Modal>
  );
}

function DonationsView() {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.donations");
  const tCommon = useTranslations("adminOps.common");
  const labels = useLabels();
  const f = useFormat();
  const { showError, toast } = useAlerts();
  const { user } = useAuth();
  const { meta } = useMeta();
  const xafPerEur = meta.xafPerEur;
  const canManage = can(user, P.MANAGE_FINANCE);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const closeDetail = useCallback(() => setSelected(null), []);

  const params = useMemo(() => cleanParams(filters), [filters]);
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.donations(params), [params]);
  const { data: projects } = useAsync(() => publicApi.listContent("projects"), []);

  const statusOptions = STATUS_KEYS.paymentStatus.map((value) => ({ value, label: labels.status("paymentStatus", value).label }));
  const providerOptions = PROVIDER_KEYS.map((value) => ({ value, label: providerLabel(labels, value, PROVIDER_METHOD[value]) }));

  const donations = useMemo(() => data || [], [data]);
  const totals = useMemo(() => {
    const succeeded = donations.filter((row) => row.status === "succeeded");
    const pending = donations.filter((row) => row.status === "pending");
    return {
      // Montant net : les remboursements partiels (le don reste "succeeded") sont deduits.
      amountEur: succeeded.reduce((sum, row) => sum + toEur(netAmount(row), row.currency, xafPerEur), 0),
      refundedEur: succeeded.reduce((sum, row) => sum + toEur(refundedOf(row), row.currency, xafPerEur), 0),
      succeeded: succeeded.length,
      pending: pending.length,
      pendingEur: pending.reduce((sum, row) => sum + toEur(row.amount, row.currency, xafPerEur), 0),
      review: donations.filter((row) => row.status === "review").length,
      donors: new Set(succeeded.map((row) => row.donor_email || `user:${row.user_id}`)).size,
    };
  }, [donations, xafPerEur]);

  const setFilter = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }));
  const hasFilters = Object.keys(params).length > 0;
  const periodInvalid = filters.from && filters.to && filters.to < filters.from;

  // Don mis a jour (verification traitee) : remplace la ligne et le detail ouvert.
  const onUpdated = (donation) => {
    if (!donation) {
      reload();
      setSelected(null);
      return;
    }
    setData((prev) => (prev || []).map((row) => (row.id === donation.id ? { ...row, ...donation } : row)));
    setSelected((prev) => (prev && prev.id === donation.id ? { ...prev, ...donation } : prev));
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportDonations(params);
      saveBlob(blob, `dons-hope-${todayStamp()}.csv`);
      toast(tCommon("exported"));
    } catch (err) {
      showError(tCommon("exportFailed"), getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: "date",
      header: t("columns.date"),
      sortable: true,
      sortValue: (row) => new Date(donationDate(row)).getTime(),
      render: (row) => <span className="adm-nowrap">{f.dateTime(donationDate(row))}</span>,
    },
    {
      key: "donor",
      header: t("columns.donor"),
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
      header: t("columns.amount"),
      className: "num",
      sortable: true,
      sortValue: (row) => toEur(row.amount, row.currency, xafPerEur),
      render: (row) => (
        <div className="cell-main">
          <strong className="adm-nowrap">{f.money(row.amount, row.currency)}</strong>
          {refundedOf(row) > 0 && (
            <span className="adm-nowrap">{t("refundedPart", { amount: f.money(refundedOf(row), row.currency) })}</span>
          )}
        </div>
      ),
    },
    {
      key: "project",
      header: t("columns.allocation"),
      render: (row) => row.project_title || <span className="muted">{t("generalFund")}</span>,
    },
    {
      key: "method",
      header: t("columns.method"),
      render: (row) => (
        <div className="cell-main">
          <strong>{row.method ? labels.method(row.method) : "—"}</strong>
          <span>{providerName(row.provider)}</span>
        </div>
      ),
    },
    {
      key: "frequency",
      header: t("columns.frequency"),
      render: (row) =>
        row.frequency === "monthly" ? <Badge tone="brand">{labels.frequency("monthly")}</Badge> : labels.frequency(row.frequency || "once"),
    },
    {
      key: "status",
      header: t("columns.status"),
      sortable: true,
      render: (row) => <StatusBadge status={labels.status("paymentStatus", row.status)} />,
    },
    {
      key: "receipt_number",
      header: t("columns.receipt"),
      render: (row) => (row.receipt_number ? <span className="adm-nowrap">{row.receipt_number}</span> : "—"),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          canManage && (
            <Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv} disabled={loading || periodInvalid}>
              {t("export")}
            </Button>
          )
        }
      />

      <form className="adm-filters" aria-label={t("filters.label")} onSubmit={(event) => event.preventDefault()}>
        <Select
          label={t("filters.status")}
          placeholder={t("filters.allStatuses")}
          options={statusOptions}
          value={filters.status}
          onChange={setFilter("status")}
        />
        <Select
          label={t("filters.provider")}
          placeholder={t("filters.allProviders")}
          options={providerOptions}
          value={filters.provider}
          onChange={setFilter("provider")}
        />
        <Select
          label={t("filters.project")}
          placeholder={t("filters.allProjects")}
          options={(projects || []).map((project) => ({ value: String(project.id), label: project.title }))}
          value={filters.projectId}
          onChange={setFilter("projectId")}
        />
        <Input label={t("filters.from")} type="date" value={filters.from} onChange={setFilter("from")} max={filters.to || undefined} />
        <Input
          label={t("filters.to")}
          type="date"
          value={filters.to}
          onChange={setFilter("to")}
          min={filters.from || undefined}
          error={periodInvalid ? t("filters.periodInvalid") : undefined}
        />
        <div className="adm-filters__actions">
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasFilters}>
            {t("filters.reset")}
          </Button>
        </div>
      </form>

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <PageSkeleton variant="stats-table" columns={6} label={t("loading")} />
      ) : (
        <>
          {canManage && totals.review > 0 && !filters.status && (
            <Alert tone="warning" title={t("reviewBanner.title", { count: totals.review })}>
              {t("reviewBanner.text")}{" "}
              <Button variant="ghost" size="sm" onClick={() => setFilters((prev) => ({ ...prev, status: "review" }))}>
                {t("reviewBanner.show")}
              </Button>
            </Alert>
          )}
          <div className="admin-grid-stats">
            <StatCard
              label={t("stats.amount")}
              value={formatEur(f, totals.amountEur)}
              hint={totals.refundedEur > 0 ? t("stats.amountHintRefunds", { amount: formatEur(f, totals.refundedEur) }) : t("stats.amountHint")}
              icon={HandCoins}
            />
            <StatCard
              label={t("stats.count")}
              value={f.number(donations.length)}
              hint={t("stats.countHint", { count: totals.succeeded })}
              icon={HeartHandshake}
              tone="info"
            />
            <StatCard label={t("stats.donors")} value={f.number(totals.donors)} hint={t("stats.donorsHint")} icon={Users} tone="accent" />
            <StatCard
              label={t("stats.pending")}
              value={f.number(totals.pending)}
              hint={totals.pending ? t("stats.pendingHint", { amount: formatEur(f, totals.pendingEur) }) : t("stats.pendingNone")}
              icon={Clock}
              tone="warning"
            />
          </div>
          <p className="adm-selection-note">
            {t("rateNote", { rate: f.number(xafPerEur, { maximumFractionDigits: 3 }) })}
            {donations.length >= LIST_LIMIT && ` ${t("limitNote", { limit: f.number(LIST_LIMIT) })}`}
          </p>

          <DataTable
            columns={columns}
            rows={donations}
            searchKeys={(row) => `${row.donor_name} ${row.donor_email} ${row.receipt_number || ""} ${row.project_title || ""}`}
            searchPlaceholder={t("search")}
            pageSize={20}
            initialSort={{ key: "date", dir: "desc" }}
            onRowClick={setSelected}
            rowLabel={(row) => (row.donor_name ? t("rowLabel", { name: row.donor_name }) : t("rowLabelAnonymous"))}
            emptyTitle={hasFilters ? t("empty.filteredTitle") : t("empty.title")}
            emptyDescription={hasFilters ? t("empty.filteredText") : t("empty.text")}
          />
        </>
      )}

      <DonationDetail
        key={selected?.id}
        donation={selected}
        xafPerEur={xafPerEur}
        canManage={canManage}
        onClose={closeDetail}
        onUpdated={onUpdated}
      />
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
