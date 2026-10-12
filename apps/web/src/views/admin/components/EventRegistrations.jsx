"use client";

// Liste des inscrits a un evenement : copie des emails, export CSV local et feuille d'emargement
// imprimable (rendue hors de la modale, seule visible a l'impression).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardCopy, Download, Printer, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, Button, DataTable, EmptyState, ErrorState, SkeletonTable, Modal, TabPanel, Tabs } from "@/src/components/ui";
import { useAsync } from "@/src/hooks/useAsync";
import { useFormat } from "@/src/i18n/format";
import { adminApi } from "@/src/services";
import { useErrorMessage } from "@/src/i18n/errors";
import { saveBlob } from "@/src/utils/format";
import { useAlerts } from "@/src/utils/alerts";
import { todayStamp } from "../lib/finance";
import AttendanceSheet, { WaitlistList, useAttendance } from "@/src/views/volunteering/AttendanceSheet";

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

// Feuille d'emargement : une ligne par inscrit (ordre alphabetique) et une colonne de signature.
function SignInSheet({ event, rows }) {
  const t = useTranslations("adminOps.registrations.sheet");
  const f = useFormat();
  const locale = f.locale;
  const sorted = [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name), locale));
  return (
    <section className="print-sheet" aria-hidden="true">
      <h1>{t("title")}</h1>
      <p className="print-sheet__event"><strong>{event.title}</strong></p>
      <p className="print-sheet__meta">
        {f.dateTime(event.start_at)}
        {event.location ? ` · ${event.location}` : ""}
        {" · "}
        {t("count", { count: rows.length })}
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">{t("number")}</th>
            <th scope="col">{t("name")}</th>
            <th scope="col">{t("contact")}</th>
            <th scope="col">{t("signature")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={row.id ?? row.email}>
              <td>{index + 1}</td>
              <td>{row.name}</td>
              <td>{[row.phone, row.email].filter(Boolean).join(" · ")}</td>
              <td className="print-sheet__sign" />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="print-sheet__foot">{t("printedAt", { date: f.dateTime(new Date().toISOString()) })}</p>
    </section>
  );
}

export default function EventRegistrations({ event, onClose }) {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.registrations");
  const f = useFormat();
  const { showError, toast } = useAlerts();
  const { data, loading, error, reload } = useAsync(() => adminApi.eventRegistrations(event.id), [event.id]);
  const rows = data || [];
  const [printing, setPrinting] = useState(false);
  const tVol = useTranslations("volunteering.attendance");
  // Appel (evenement commence) et liste d'attente : module benevolat.
  const [tab, setTab] = useState(() => (new Date(event.start_at).getTime() <= Date.now() ? "attendance" : "registrations"));
  const attendance = useAttendance(event.id);
  const waitlist = attendance.data?.waitlist || [];

  // Impression de la feuille seule : classe posee sur <body> le temps de l'impression.
  useEffect(() => {
    if (!printing) return undefined;
    document.body.classList.add("is-printing-sheet");
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("is-printing-sheet");
    };
  }, [printing]);

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
    saveBlob(blob, t("csvFile", { event: slug(event.title), date: todayStamp() }));
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
    {
      key: "attendance",
      header: tVol("columns.attendance"),
      sortable: true,
      sortValue: (row) => row.attendance || "",
      render: (row) =>
        row.attendance === "present" ? (
          <Badge tone="success">{tVol("presentHours", { hours: f.number(row.hours, { maximumFractionDigits: 2 }) })}</Badge>
        ) : row.attendance === "absent" ? (
          <Badge tone="danger">{tVol("absent")}</Badge>
        ) : (
          <span className="muted">—</span>
        ),
    },
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
          <Button variant="secondary" icon={Printer} onClick={() => setPrinting(true)} disabled={!rows.length}>{t("print")}</Button>
          <Button icon={Download} onClick={exportCsv} disabled={!rows.length}>{t("export")}</Button>
        </>
      }
    >
      <Tabs
        id="event-registrations-tabs"
        tabs={[
          { value: "registrations", label: tVol("tabs.registrations"), count: rows.length },
          { value: "attendance", label: tVol("tabs.attendance") },
          { value: "waitlist", label: tVol("tabs.waitlist"), count: waitlist.length },
        ]}
        value={tab}
        onChange={setTab}
        label={tVol("tabs.label")}
      />
      <TabPanel tabsId="event-registrations-tabs" value={tab}>
        {tab === "registrations" && (error ? (
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        ) : loading ? (
          <SkeletonTable toolbar={false} columns={4} label={t("loading")} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title={t("emptyTitle")} description={t("emptyText")} />
        ) : (
          <DataTable columns={columns} rows={rows} searchKeys={["name", "email", "region"]} searchPlaceholder={t("search")} pageSize={10} />
        ))}
        {tab === "attendance" && (
          <AttendanceSheet
            sheet={attendance.data}
            loading={attendance.loading}
            error={attendance.error}
            reload={attendance.reload}
            onSaved={(saved) => {
              attendance.setData(saved);
              reload();
            }}
          />
        )}
        {tab === "waitlist" && <WaitlistList rows={waitlist} />}
      </TabPanel>
      {printing && createPortal(<SignInSheet event={event} rows={rows} />, document.body)}
    </Modal>
  );
}
