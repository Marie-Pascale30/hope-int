"use client";

// Engagements de don mensuel Mobile Money : liste et regularite (echeances payees / manquees).
import "../../../styles/fundraising.css";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, DataTable, ErrorState, PageHeader, PageSkeleton, Select } from "../../../components/ui";
import RequireAuth from "../../../components/RequireAuth";
import { useAsync } from "../../../hooks/useAsync";
import { fundraisingAdminApi } from "../../../services/fundraising";
import { useFormat } from "../../../i18n/format";
import { useErrorMessage } from "../../../i18n/errors";
import { PERMISSIONS as P } from "../../../utils/rbac";
import { PLEDGE_STATUSES } from "@hope/shared/fundraising";

const STATUS_TONES = { active: "success", paused: "warning", stopped: "danger" };

function PledgesView() {
  const t = useTranslations("fundraising.admin.pledges");
  const tp = useTranslations("fundraising.pledge");
  const f = useFormat();
  const errorText = useErrorMessage();
  const [status, setStatus] = useState("active");
  const { data, loading, error, reload } = useAsync(() => fundraisingAdminApi.pledges(status ? { status } : {}), [status]);

  const columns = [
    {
      key: "donor",
      header: t("columns.donor"),
      render: (row) => (
        <div className="cell-main">
          <strong>{row.donor_name}</strong>
          <span>{row.donor_email}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: t("columns.amount"),
      sortable: true,
      sortValue: (row) => row.amount,
      render: (row) => tp("summary", { amount: f.money(row.amount, row.currency), day: row.day_of_month }),
    },
    { key: "project", header: t("columns.project"), render: (row) => row.project_title || tp("generalFund") },
    {
      key: "regularity",
      header: t("columns.regularity"),
      sortable: true,
      sortValue: (row) => row.regularity.rate ?? -1,
      render: (row) => (row.regularity.rate === null
        ? tp("regularityNone")
        : tp("regularity", { paid: row.regularity.paid, missed: row.regularity.missed, rate: row.regularity.rate })),
    },
    { key: "created_at", header: t("columns.since"), sortable: true, render: (row) => f.date(row.created_at) },
    { key: "status", header: t("columns.status"), render: (row) => <Badge tone={STATUS_TONES[row.status]}>{tp(`status.${row.status}`)}</Badge> },
  ];

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <div className="panel">
        <Select
          label={t("filter")}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          placeholder={t("allStatuses")}
          options={PLEDGE_STATUSES.map((value) => ({ value, label: tp(`status.${value}`) }))}
        />
        {error ? (
          <ErrorState message={errorText(error)} onRetry={reload} />
        ) : loading && !data ? (
          <PageSkeleton />
        ) : (
          <DataTable columns={columns} rows={data || []} searchKeys={["donor_name", "donor_email"]} emptyTitle={t("emptyTitle")} />
        )}
      </div>
    </>
  );
}

export default function PledgesAdmin() {
  return (
    <RequireAuth permission={P.VIEW_DONATIONS}>
      <PledgesView />
    </RequireAuth>
  );
}
