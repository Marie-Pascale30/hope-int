"use client";

// Liste des inscrits a un evenement : copie des emails et export CSV local.
import { ClipboardCopy, Download, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, DataTable, EmptyState, ErrorState, SkeletonTable, Modal } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { useFormat } from "../../../i18n/format";
import { adminApi } from "../../../services";
import { useErrorMessage } from "../../../i18n/errors";
import { saveBlob } from "../../../utils/format";
import { useAlerts } from "../../../utils/alerts";
import { todayStamp } from "./finance";

// Cellule CSV : separateur ";", guillemets echappes, formules neutralisees (Excel).
function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const slug = (text) =>
  String(text || "evenement")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export default function EventRegistrations({ event, onClose }) {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.registrations");
  const f = useFormat();
  const { showError, toast } = useAlerts();
  const { data, loading, error, reload } = useAsync(() => adminApi.eventRegistrations(event.id), [event.id]);
  const rows = data || [];

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(rows.map((row) => row.email).join(", "));
      toast(t("copied", { count: rows.length }));
    } catch {
      showError(t("copyFailed"), t("copyFailedText"));
    }
  };

  const exportCsv = () => {
    const header = [t("csv.name"), t("csv.email"), t("csv.phone"), t("csv.region"), t("csv.registeredAt")];
    const lines = rows.map((row) =>
      [row.name, row.email, row.phone, row.region, f.dateTime(row.created_at)].map(csvCell).join(";")
    );
    const blob = new Blob([`﻿${[header.map(csvCell).join(";"), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    saveBlob(blob, `inscrits-${slug(event.title)}-${todayStamp()}.csv`);
    toast(t("exported"));
  };

  const columns = [
    {
      key: "name",
      header: t("columns.participant"),
      sortable: true,
      render: (row) => (
        <div className="cell-main">
          <strong>{row.name}</strong>
          <span>{row.email}</span>
        </div>
      ),
    },
    { key: "phone", header: t("columns.phone"), render: (row) => row.phone || "—" },
    { key: "region", header: t("columns.region"), sortable: true, render: (row) => row.region || "—" },
    {
      key: "created_at",
      header: t("columns.registeredAt"),
      sortable: true,
      render: (row) => <span className="adm-nowrap">{f.shortDate(row.created_at)}</span>,
    },
  ];

  return (
    <Modal
      open
      large
      title={t("title", { title: event.title })}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("close")}</Button>
          <Button variant="secondary" icon={ClipboardCopy} onClick={copyEmails} disabled={!rows.length}>{t("copy")}</Button>
          <Button icon={Download} onClick={exportCsv} disabled={!rows.length}>{t("export")}</Button>
        </>
      }
    >
      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading ? (
        <SkeletonTable toolbar={false} columns={4} label={t("loading")} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={t("emptyTitle")} description={t("emptyText")} />
      ) : (
        <DataTable columns={columns} rows={rows} searchKeys={["name", "email", "region"]} searchPlaceholder={t("search")} pageSize={10} />
      )}
    </Modal>
  );
}
