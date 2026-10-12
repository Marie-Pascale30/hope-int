"use client";

// Publication des chiffres annuels (direction) et documents publics (rapports annuels PDF).
// Une annee non publiee n'apparait jamais sur la page publique /transparence.
import "@/src/styles/transparency.css";
import { useState } from "react";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { PUBLIC_DOCUMENT_KINDS } from "@hope/shared/transparency";
import { hasGlobalScope } from "@hope/shared/rbac";
import { Alert, Badge, Button, ErrorState, Input, PageHeader, PageSkeleton, Select, Textarea } from "@/src/components/ui";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/context/AuthContext";
import { useAsync } from "@/src/hooks/useAsync";
import { useFormat } from "@/src/i18n/format";
import { useErrorMessage } from "@/src/i18n/errors";
import { transparencyApi } from "@/src/services/transparency";
import { resolveImage } from "@/src/utils/format";
import { useAlerts } from "@/src/utils/alerts";
import { PERMISSIONS as P } from "@/src/utils/rbac";
import AdminTabs from "./AdminTabs";

function YearRow({ row, canPublish, onDone }) {
  const t = useTranslations("transparency.admin.publication");
  const tCommon = useTranslations("transparency.admin.common");
  const f = useFormat();
  const getErrorMessage = useErrorMessage();
  const { toast, showError, confirmAction } = useAlerts();
  const [note, setNote] = useState(row.note || "");
  const [saving, setSaving] = useState(false);

  const save = async (published) => {
    if (published && !row.published) {
      const ok = await confirmAction(t("confirmTitle", { year: row.year }), t("confirmText"), t("publish"));
      if (!ok) return;
    }
    setSaving(true);
    try {
      await transparencyApi.setYear(row.year, { published, note: note || null });
      toast(published ? t("published", { year: row.year }) : t("unpublished", { year: row.year }));
      onDone();
    } catch (error) {
      showError(tCommon("saveFailed"), getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="tp-year">
      <div className="tp-year__head">
        <strong>{row.year}</strong>
        {row.published ? (
          <Badge tone="success">{t("statusPublished", { date: row.publishedAt ? f.date(row.publishedAt) : "—" })}</Badge>
        ) : (
          <Badge>{t("statusDraft")}</Badge>
        )}
        {row.published && (
          <a href={`/transparence/${row.year}`} target="_blank" rel="noreferrer" className="tp-year__link">
            {t("view")} <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
      <Textarea label={t("note")} hint={t("noteHint")} value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={2000} disabled={!canPublish} />
      {canPublish && (
        <div className="tp-year__actions">
          {row.published ? (
            <>
              <Button variant="secondary" size="sm" loading={saving} onClick={() => save(true)}>{t("saveNote")}</Button>
              <Button variant="ghost" size="sm" loading={saving} onClick={() => save(false)}>{t("unpublish")}</Button>
            </>
          ) : (
            <Button size="sm" loading={saving} onClick={() => save(true)}>{t("publish")}</Button>
          )}
        </div>
      )}
    </li>
  );
}

function DocumentForm({ years, onDone }) {
  const t = useTranslations("transparency.admin.documents");
  const tKinds = useTranslations("transparency.documentKinds");
  const tCommon = useTranslations("transparency.admin.common");
  const getErrorMessage = useErrorMessage();
  const { toast, showError } = useAlerts();
  const [form, setForm] = useState({ title: "", year: String(years[0] || new Date().getFullYear()), kind: "annual_report", file: null });
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await transparencyApi.createDocument(form);
      toast(t("uploaded"));
      setForm((current) => ({ ...current, title: "", file: null }));
      setFormKey((key) => key + 1);
      onDone();
    } catch (error) {
      showError(tCommon("saveFailed"), getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form key={formKey} className="form-grid" onSubmit={submit}>
      <Input label={t("title")} value={form.title} onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))} minLength={3} maxLength={255} required full />
      <Select label={t("year")} value={form.year} onChange={(event) => setForm((c) => ({ ...c, year: event.target.value }))} options={years.map((year) => ({ value: String(year), label: String(year) }))} />
      <Select label={t("kind")} value={form.kind} onChange={(event) => setForm((c) => ({ ...c, kind: event.target.value }))} options={PUBLIC_DOCUMENT_KINDS.map((value) => ({ value, label: tKinds(value) }))} />
      <Input label={t("file")} type="file" accept="application/pdf" hint={t("fileHint")} onChange={(event) => setForm((c) => ({ ...c, file: event.target.files?.[0] || null }))} required full />
      <div><Button type="submit" icon={Upload} loading={saving}>{t("upload")}</Button></div>
    </form>
  );
}

function PublicationView() {
  const t = useTranslations("transparency.admin.publication");
  const tDocs = useTranslations("transparency.admin.documents");
  const tKinds = useTranslations("transparency.documentKinds");
  const tCommon = useTranslations("transparency.admin.common");
  const { user } = useAuth();
  const getErrorMessage = useErrorMessage();
  const { toast, showError, confirmAction } = useAlerts();
  const years = useAsync(() => transparencyApi.years(), []);
  const documents = useAsync(() => transparencyApi.documents(), []);
  const canPublish = hasGlobalScope(user?.roles || []);
  const yearList = (years.data?.years || []).map((row) => row.year);

  const removeDocument = async (doc) => {
    const ok = await confirmAction(tDocs("confirmTitle"), tDocs("confirmText", { title: doc.title }), tCommon("delete"));
    if (!ok) return;
    try {
      await transparencyApi.deleteDocument(doc.id);
      toast(tCommon("deleted"));
      documents.reload();
    } catch (error) {
      showError(tCommon("deleteFailed"), getErrorMessage(error));
    }
  };

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <AdminTabs />
      {!canPublish && <Alert tone="info" title={t("readOnlyTitle")}>{t("readOnlyText")}</Alert>}

      <section className="panel" aria-labelledby="tp-years-title" style={{ marginBottom: 24 }}>
        <div className="panel__head">
          <div>
            <h2 id="tp-years-title" className="panel__title">{t("yearsTitle")}</h2>
            <p className="panel__desc">{t("yearsText")}</p>
          </div>
        </div>
        {years.error ? (
          <ErrorState message={getErrorMessage(years.error)} onRetry={years.reload} />
        ) : years.loading || !years.data ? (
          <PageSkeleton variant="table" label={t("loading")} />
        ) : (
          <ul className="tp-years-admin">
            {years.data.years.map((row) => <YearRow key={`${row.year}-${row.published}`} row={row} canPublish={canPublish} onDone={years.reload} />)}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="tp-docs-admin-title">
        <div className="panel__head">
          <div>
            <h2 id="tp-docs-admin-title" className="panel__title">{tDocs("sectionTitle")}</h2>
            <p className="panel__desc">{tDocs("sectionText")}</p>
          </div>
        </div>
        {yearList.length > 0 && <DocumentForm years={yearList} onDone={documents.reload} />}
        {documents.error ? (
          <ErrorState message={getErrorMessage(documents.error)} onRetry={documents.reload} />
        ) : (
          <ul className="tp-docs tp-docs--admin">
            {(documents.data?.documents || []).map((doc) => (
              <li key={doc.id}>
                <FileText aria-hidden="true" />
                <div>
                  <strong>{doc.title}</strong>
                  <span className="muted">{tKinds(doc.kind)} · {doc.year}</span>
                </div>
                <a href={resolveImage(doc.file_url)} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">{tDocs("open")}</a>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => removeDocument(doc)} aria-label={tCommon("deleteNamed", { name: doc.title })} />
              </li>
            ))}
            {documents.data?.documents?.length === 0 && <li className="muted">{tDocs("empty")}</li>}
          </ul>
        )}
      </section>
    </>
  );
}

export default function PublicationAdmin() {
  return (
    <RequireAuth permission={P.MANAGE_FINANCE}>
      <PublicationView />
    </RequireAuth>
  );
}
