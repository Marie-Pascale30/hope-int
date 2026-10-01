"use client";

// Liste des inscrits a un evenement : copie des emails et export CSV local.
import { ClipboardCopy, Download, Users } from "lucide-react";
import { Button, DataTable, EmptyState, ErrorState, LoadingState, Modal } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { adminApi } from "../../../services";
import { getErrorMessage } from "../../../services/api";
import { formatDateTime, formatShortDate, saveBlob } from "../../../utils/format";
import { showError, toast } from "../../../utils/alerts";
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
  const { data, loading, error, reload } = useAsync(() => adminApi.eventRegistrations(event.id), [event.id]);
  const rows = data || [];

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(rows.map((row) => row.email).join(", "));
      toast(`${rows.length} adresse(s) copiée(s)`);
    } catch {
      showError("Copie impossible", "Votre navigateur a bloqué l'accès au presse-papiers.");
    }
  };

  const exportCsv = () => {
    const header = ["Nom", "Email", "Téléphone", "Région", "Inscrit le"];
    const lines = rows.map((row) =>
      [row.name, row.email, row.phone, row.region, formatDateTime(row.created_at)].map(csvCell).join(";")
    );
    const blob = new Blob([`﻿${[header.join(";"), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    saveBlob(blob, `inscrits-${slug(event.title)}-${todayStamp()}.csv`);
    toast("Liste des inscrits téléchargée");
  };

  const columns = [
    {
      key: "name",
      header: "Participant",
      sortable: true,
      render: (row) => (
        <div className="cell-main">
          <strong>{row.name}</strong>
          <span>{row.email}</span>
        </div>
      ),
    },
    { key: "phone", header: "Téléphone", render: (row) => row.phone || "—" },
    { key: "region", header: "Région", sortable: true, render: (row) => row.region || "—" },
    {
      key: "created_at",
      header: "Inscrit le",
      sortable: true,
      render: (row) => <span className="admb-nowrap">{formatShortDate(row.created_at)}</span>,
    },
  ];

  return (
    <Modal
      open
      large
      title={`Inscrits — ${event.title}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          <Button variant="secondary" icon={ClipboardCopy} onClick={copyEmails} disabled={!rows.length}>Copier les emails</Button>
          <Button icon={Download} onClick={exportCsv} disabled={!rows.length}>Exporter en CSV</Button>
        </>
      }
    >
      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading ? (
        <LoadingState label="Chargement des inscrits…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="Aucun inscrit pour l'instant" description="Les membres inscrits depuis le site apparaîtront ici." />
      ) : (
        <DataTable columns={columns} rows={rows} searchKeys={["name", "email", "region"]} searchPlaceholder="Nom, email, région…" pageSize={10} />
      )}
    </Modal>
  );
}
