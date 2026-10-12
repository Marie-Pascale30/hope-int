"use client";

// Dons hors ligne (especes, virement, cheque, en nature) : saisie avec justificatif, puis validation
// par une seconde personne de la finance (jamais l'auteur) qui emet le recu numerote.
import "../../../styles/fundraising.css";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, FileDown, Plus, X } from "lucide-react";
import { Alert, Badge, Button, DataTable, ErrorState, Input, Modal, PageHeader, PageSkeleton, Select, Textarea, focusFirstInvalid } from "../../../components/ui";
import RequireAuth from "../../../components/RequireAuth";
import { useAuth } from "../../../context/AuthContext";
import { useAsync } from "../../../hooks/useAsync";
import { publicApi } from "../../../services";
import { fundraisingAdminApi } from "../../../services/fundraising";
import { useFormat } from "../../../i18n/format";
import { useErrorMessage } from "../../../i18n/errors";
import { useAlerts } from "../../../utils/alerts";
import { saveBlob } from "../../../utils/format";
import { PERMISSIONS as P } from "../../../utils/rbac";
import { OFFLINE_KINDS, OFFLINE_STATUSES } from "@hope/shared/fundraising";

const STATUS_TONES = { pending_validation: "warning", validated: "success", rejected: "danger" };
const EMPTY = { kind: "cash", amount: "", currency: "xaf", donorName: "", donorEmail: "", projectId: "", receivedOn: "", reference: "", inKindDescription: "", note: "" };
const PROOF_TYPES = "application/pdf,image/jpeg,image/png,image/webp";

function OfflineForm({ open, onClose, onCreated }) {
  const t = useTranslations("fundraising.admin.offline.form");
  const errorText = useErrorMessage();
  const projects = useAsync(() => publicApi.listContent("projects"), [], { enabled: open });
  const [form, setForm] = useState(EMPTY);
  const [proof, setProof] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const amount = Number(String(form.amount).replace(",", "."));
  const errors = {};
  if (!(amount > 0)) errors.amount = t("errors.amount");
  if (form.donorName.trim().length < 2) errors.donorName = t("errors.donorName");
  if (!form.receivedOn) errors.receivedOn = t("errors.receivedOn");
  if (form.kind === "in_kind" && form.inKindDescription.trim().length < 3) errors.inKindDescription = t("errors.inKind");
  const shown = submitted ? errors : {};

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.keys(errors).length) {
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setSaving(true);
    try {
      await fundraisingAdminApi.createOfflineDonation({
        ...form,
        amount,
        inKindDescription: form.kind === "in_kind" ? form.inKindDescription : undefined,
        proof: proof || undefined,
      });
      setForm(EMPTY);
      setProof(null);
      setSubmitted(false);
      onCreated();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("title")} large>
      <form className="fr-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <Select label={t("kind")} value={form.kind} onChange={set("kind")} options={OFFLINE_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))} />
          <Input label={t("receivedOn")} type="date" required value={form.receivedOn} onChange={set("receivedOn")} error={shown.receivedOn} />
          <Input
            label={form.kind === "in_kind" ? t("valuation") : t("amount")}
            inputMode="decimal"
            required
            value={form.amount}
            onChange={set("amount")}
            error={shown.amount}
          />
          <Select label={t("currency")} value={form.currency} onChange={set("currency")} options={[{ value: "xaf", label: "FCFA (XAF)" }, { value: "eur", label: "Euro (EUR)" }]} />
          <Input label={t("donorName")} required value={form.donorName} onChange={set("donorName")} error={shown.donorName} />
          <Input label={t("donorEmail")} type="email" value={form.donorEmail} onChange={set("donorEmail")} hint={t("donorEmailHint")} />
          <Select
            label={t("project")}
            value={form.projectId}
            onChange={set("projectId")}
            placeholder={t("generalFund")}
            options={(projects.data || []).map((project) => ({ value: String(project.id), label: project.title }))}
          />
          {(form.kind === "check" || form.kind === "transfer") && (
            <Input label={t(`reference.${form.kind}`)} maxLength={100} value={form.reference} onChange={set("reference")} />
          )}
        </div>
        {form.kind === "in_kind" && (
          <Input
            label={t("inKindDescription")}
            required
            maxLength={200}
            value={form.inKindDescription}
            onChange={set("inKindDescription")}
            error={shown.inKindDescription}
            hint={t("inKindHint")}
          />
        )}
        <Textarea label={t("note")} rows={2} maxLength={500} value={form.note} onChange={set("note")} />
        <Input
          label={t("proof")}
          type="file"
          accept={PROOF_TYPES}
          onChange={(event) => setProof(event.target.files?.[0] || null)}
          hint={t("proofHint")}
        />
        <Alert tone="info">{t("fourEyes")}</Alert>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="fr-form__actions">
          <Button type="submit" loading={saving}>{t("submit")}</Button>
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
        </div>
      </form>
    </Modal>
  );
}

function OfflineDonationsView() {
  const t = useTranslations("fundraising.admin.offline");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { user } = useAuth();
  const { confirmAction, showError, toast } = useAlerts();
  const [status, setStatus] = useState("pending_validation");
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload } = useAsync(() => fundraisingAdminApi.offlineDonations(status ? { status } : {}), [status]);

  const validate = async (row) => {
    const ok = await confirmAction(t("validateTitle"), t("validateText", { amount: f.money(row.amount, row.currency), donor: row.donor_name }), t("validate"));
    if (!ok) return;
    try {
      const result = await fundraisingAdminApi.validateOfflineDonation(row.id);
      toast(t("validated", { receipt: result.receipt_number || "" }));
      reload();
    } catch (err) {
      showError(t("validateTitle"), errorText(err));
    }
  };

  const reject = async (row) => {
    const ok = await confirmAction(t("rejectTitle"), t("rejectText"), t("reject"), { danger: true });
    if (!ok) return;
    try {
      await fundraisingAdminApi.rejectOfflineDonation(row.id);
      toast(t("rejected"));
      reload();
    } catch (err) {
      showError(t("rejectTitle"), errorText(err));
    }
  };

  const downloadProof = async (row) => {
    try {
      saveBlob(await fundraisingAdminApi.offlineProof(row.id), row.proof_name || "justificatif");
    } catch (err) {
      showError(t("proofError"), errorText(err));
    }
  };

  const columns = [
    { key: "received_on", header: t("columns.date"), sortable: true, render: (row) => f.date(row.received_on) },
    {
      key: "donor",
      header: t("columns.donor"),
      render: (row) => (
        <div className="cell-main">
          <strong>{row.donor_name}</strong>
          <span>{row.donor_email || "—"}</span>
        </div>
      ),
    },
    {
      key: "kind",
      header: t("columns.kind"),
      render: (row) => (
        <div className="cell-main">
          <span>{t(`form.kinds.${row.kind}`)}</span>
          {row.in_kind_description && <span>{row.in_kind_description}</span>}
          {row.reference && <span>{row.reference}</span>}
        </div>
      ),
    },
    { key: "amount", header: t("columns.amount"), sortable: true, sortValue: (row) => row.amount, render: (row) => f.money(row.amount, row.currency) },
    { key: "project", header: t("columns.project"), render: (row) => row.project_title || t("form.generalFund") },
    {
      key: "status",
      header: t("columns.status"),
      render: (row) => (
        <div className="cell-main">
          <Badge tone={STATUS_TONES[row.status]}>{t(`statuses.${row.status}`)}</Badge>
          <span>{t("enteredBy", { name: row.created_by_name || "—" })}</span>
          {row.validated_by_name && <span>{t("decidedBy", { name: row.validated_by_name })}</span>}
          {row.receipt_number && <span>{row.receipt_number}</span>}
        </div>
      ),
    },
    {
      key: "actions",
      header: t("columns.actions"),
      render: (row) => (
        <div className="fr-item__actions">
          {row.has_proof && <Button size="sm" variant="ghost" icon={FileDown} onClick={() => downloadProof(row)}>{t("proof")}</Button>}
          {row.status === "pending_validation" && (
            Number(row.created_by) === Number(user?.id) ? (
              <span className="muted">{t("waitingOther")}</span>
            ) : (
              <Button size="sm" icon={Check} onClick={() => validate(row)}>{t("validate")}</Button>
            )
          )}
          {row.status === "pending_validation" && <Button size="sm" variant="ghost" icon={X} onClick={() => reject(row)}>{t("reject")}</Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={<Button icon={Plus} onClick={() => setCreating(true)}>{t("create")}</Button>}
      />
      <div className="panel">
        <Select
          label={t("filter")}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          placeholder={t("allStatuses")}
          options={OFFLINE_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) }))}
        />
        {error ? (
          <ErrorState message={errorText(error)} onRetry={reload} />
        ) : loading && !data ? (
          <PageSkeleton />
        ) : (
          <DataTable
            columns={columns}
            rows={data || []}
            searchKeys={["donor_name", "donor_email", "reference", "receipt_number"]}
            emptyTitle={t("emptyTitle")}
            emptyDescription={t("emptyText")}
          />
        )}
      </div>
      <OfflineForm
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          toast(t("created"));
          if (status === "pending_validation") reload();
          else setStatus("pending_validation");
        }}
      />
    </>
  );
}

export default function OfflineDonations() {
  return (
    <RequireAuth permission={P.MANAGE_FINANCE}>
      <OfflineDonationsView />
    </RequireAuth>
  );
}
