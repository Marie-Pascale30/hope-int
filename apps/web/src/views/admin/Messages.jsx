"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Inbox, Mail, MailOpen, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button, EmptyState, ErrorState, PageSkeleton, PageHeader, Select, StatusBadge, TabPanel, Tabs, Textarea,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { useFormat } from "../../i18n/format";
import { adminApi } from "../../services";
import { toast, useAlerts } from "../../utils/alerts";
import { truncate } from "../../utils/format";
import { STATUS_KEYS, useLabels } from "../../utils/labels";
import { PERMISSIONS as P } from "../../utils/rbac";
import { useErrorMessage } from "../../i18n/errors";
import { PAGE_SIZE, ServerPagination, countOf, toPage } from "./parts-a/paging";

const STATUS_ORDER = STATUS_KEYS.messageStatus; // nouveau, lu, traite, archive

function MessagePanel({ message, staff, onBack, onSaved, onDeleted }) {
  const t = useTranslations("admin.messages.panel");
  const tc = useTranslations("admin.common");
  const f = useFormat();
  const labels = useLabels();
  const errorText = useErrorMessage();
  const { confirmAction, showError } = useAlerts();
  const [form, setForm] = useState({
    status: message.status,
    assignedTo: message.assigned_to ? String(message.assigned_to) : "",
    notes: message.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const dirty = form.status !== message.status
    || form.assignedTo !== (message.assigned_to ? String(message.assigned_to) : "")
    || form.notes !== (message.notes || "");

  const statusOptions = STATUS_ORDER.map((value) => ({ value, label: labels.status("messageStatus", value).label }));
  const staffOptions = staff.map((person) => ({
    value: String(person.id),
    label: t("staffOption", { name: person.name, role: labels.role(person.roles?.[0]) }),
  }));

  // PATCH /admin/messages/:id renvoie la ligne complete (avec assigned_name) : mise a jour sur place.
  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminApi.updateMessage(message.id, {
        status: form.status,
        assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
        notes: form.notes.trim() || null,
      });
      onSaved(updated, message.status);
      toast(t("saved"));
    } catch (err) {
      showError(t("saveFailed"), errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirmAction(
      t("deleteConfirmTitle"),
      t("deleteConfirmText", { name: message.name }),
      tc("delete"),
      { danger: true }
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await adminApi.deleteMessage(message.id);
      onDeleted(message);
      toast(t("deleted"));
    } catch (err) {
      showError(t("deleteFailed"), errorText(err));
      setDeleting(false);
    }
  };

  const mailto = `mailto:${message.email}?subject=${encodeURIComponent(t("replySubject", { subject: message.subject }))}`;

  return (
    <article className="adm-reader" aria-labelledby="adm-reader-title">
      <Button variant="ghost" size="sm" icon={ArrowLeft} className="adm-reader__back" onClick={onBack}>
        {t("back")}
      </Button>
      <header className="adm-reader__head">
        <h2 id="adm-reader-title" ref={titleRef} tabIndex={-1}>{message.subject}</h2>
        <div className="adm-reader__meta">
          <strong>{message.name}</strong>
          <span>{message.email}</span>
          <span>{f.dateTime(message.created_at)}</span>
        </div>
      </header>

      <div className="adm-reader__content">{message.content}</div>

      <div className="row">
        <a className="btn" href={mailto}><Mail aria-hidden="true" /> {t("reply")}</a>
        <span className="muted adm-small">{t("address")} <span className="adm-mono">{message.email}</span></span>
      </div>

      <hr className="divider" />

      <div className="form-grid">
        <Select
          label={t("status")}
          options={statusOptions}
          value={form.status}
          onChange={(event) => setForm({ ...form, status: event.target.value })}
        />
        <Select
          label={t("assignee")}
          placeholder={t("nobody")}
          options={staffOptions}
          value={form.assignedTo}
          onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}
        />
        <Textarea
          full
          label={t("notes")}
          hint={t("notesHint")}
          rows={4}
          maxLength={5000}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </div>

      <div className="row row--between adm-reader__actions">
        <Button variant="ghost" icon={Trash2} className="adm-danger-text" loading={deleting} onClick={remove}>
          {tc("delete")}
        </Button>
        <Button icon={Save} loading={saving} disabled={!dirty} onClick={save}>{tc("save")}</Button>
      </div>
      {message.handled_at && <p className="muted adm-small">{t("handledAt", { date: f.dateTime(message.handled_at) })}</p>}
    </article>
  );
}

// Pagination serveur : GET /admin/messages?status&page&pageSize -> { rows, total, page, pageSize }.
function MessagesInbox() {
  const t = useTranslations("admin.messages");
  const f = useFormat();
  const labels = useLabels();
  const errorText = useErrorMessage();
  const { showError } = useAlerts();
  const [tab, setTab] = useState("nouveau");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload, setData } = useAsync(
    async () => toPage(await adminApi.messages({ status: tab, page, pageSize: PAGE_SIZE })),
    [tab, page]
  );
  // Compteurs des onglets (total par statut), ajustes localement apres chaque modification.
  const { data: counts, setData: setCounts } = useAsync(async () => {
    const totals = await Promise.all(STATUS_ORDER.map((status) => countOf(adminApi.messages, { status })));
    return Object.fromEntries(STATUS_ORDER.map((status, index) => [status, totals[index]]));
  }, []);
  const { data: staff } = useAsync(() => adminApi.staff(), []);
  const [selectedId, setSelectedId] = useState(null);

  const messages = useMemo(() => data?.rows || [], [data]);
  const total = data?.total || 0;
  const selected = messages.find((item) => item.id === selectedId);
  const totalAll = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : null;

  const moveCount = (from, to) => {
    if (from === to) return;
    setCounts((current) => current && ({
      ...current,
      ...(from ? { [from]: Math.max(0, (current[from] || 0) - 1) } : {}),
      ...(to ? { [to]: (current[to] || 0) + 1 } : {}),
    }));
  };

  // La ligne reste dans la page affichee (meme si son statut change) jusqu'au prochain chargement.
  const replace = (updated, previousStatus) => {
    setData((current) => ({ ...current, rows: current.rows.map((item) => (item.id === updated.id ? updated : item)) }));
    moveCount(previousStatus, updated.status);
  };

  const changeTab = (value) => {
    setTab(value);
    setPage(1);
    setSelectedId(null);
  };

  // Ouvrir un message nouveau le marque comme lu (le statut reste modifiable ensuite).
  const openMessage = async (message) => {
    setSelectedId(message.id);
    if (message.status !== "nouveau") return;
    try {
      replace(await adminApi.updateMessage(message.id, { status: "lu" }), message.status);
    } catch (err) {
      showError(t("markReadFailed"), errorText(err));
    }
  };

  const handleDeleted = (message) => {
    setSelectedId(null);
    moveCount(message.status, null);
    if (messages.length === 1 && page > 1) setPage(page - 1);
    else reload();
  };

  const header = <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />;

  if (loading && !data) return <>{header}<PageSkeleton variant="panels" label={t("loading")} /></>;
  if (error && !data) return <>{header}<ErrorState message={errorText(error)} onRetry={reload} /></>;

  return (
    <>
      {header}
      {totalAll === 0 ? (
        <EmptyState icon={Inbox} title={t("emptyTitle")} description={t("emptyText")} />
      ) : (
        <>
          <Tabs
            id="messages-tabs"
            label={t("tabsLabel")}
            value={tab}
            onChange={changeTab}
            tabs={STATUS_ORDER.map((value) => ({ value, label: t(`tabs.${value}`), count: counts ? counts[value] || 0 : undefined }))}
          />
          {error && <ErrorState message={errorText(error)} onRetry={reload} />}
          <div className={`adm-inbox${selected ? " has-selection" : ""}`}>
            <TabPanel tabsId="messages-tabs" value={tab} className="adm-inbox__list">
              <div aria-busy={loading}>
                {messages.length === 0 ? (
                  <EmptyState
                    icon={MailOpen}
                    title={t("emptyTabTitle")}
                    description={tab === "nouveau" ? t("emptyTabNew") : t("emptyTabOther")}
                  />
                ) : (
                  <ul aria-label={t("listLabel", { tab: t(`tabs.${tab}`) })}>
                    {messages.map((message) => (
                      <li key={message.id}>
                        <button
                          type="button"
                          className={`adm-mail${message.id === selectedId ? " is-active" : ""}${message.status === "nouveau" ? " is-unread" : ""}`}
                          aria-current={message.id === selectedId ? "true" : undefined}
                          onClick={() => openMessage(message)}
                        >
                          <span className="adm-mail__top">
                            <strong>{message.name}</strong>
                            <time dateTime={message.created_at}>{f.relative(message.created_at)}</time>
                          </span>
                          <span className="adm-mail__subject">{message.subject}</span>
                          <span className="adm-mail__excerpt">{truncate(message.content, 90)}</span>
                          <span className="adm-mail__foot">
                            <StatusBadge status={labels.status("messageStatus", message.status)} />
                            {message.assigned_name && (
                              <span>
                                <span aria-hidden="true">→ {message.assigned_name}</span>
                                <span className="visually-hidden">{t("assignedTo", { name: message.assigned_name })}</span>
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <ServerPagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} disabled={loading} />
              </div>
            </TabPanel>
            <div className="adm-inbox__panel">
              {selected ? (
                <MessagePanel
                  key={`${selected.id}-${selected.status}-${selected.assigned_to}-${selected.notes}`}
                  message={selected}
                  staff={staff || []}
                  onBack={() => setSelectedId(null)}
                  onSaved={replace}
                  onDeleted={handleDeleted}
                />
              ) : (
                <EmptyState icon={Mail} title={t("selectTitle")} description={t("selectText")} />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function Messages() {
  return (
    <RequireAuth permission={P.VIEW_MESSAGES}>
      <MessagesInbox />
    </RequireAuth>
  );
}
