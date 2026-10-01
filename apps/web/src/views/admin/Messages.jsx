"use client";

import "../../styles/admin-a.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Inbox, Mail, MailOpen, Save, Trash2 } from "lucide-react";
import {
  Button, EmptyState, ErrorState, LoadingState, PageHeader, Select, StatusBadge, Tabs, Textarea,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { confirmAction, showError, toast } from "../../utils/alerts";
import { formatDateTime, formatRelative, truncate } from "../../utils/format";
import { MESSAGE_STATUS, roleLabel, statusOf } from "../../utils/labels";
import { PERMISSIONS as P } from "../../utils/rbac";

const STATUS_ORDER = ["nouveau", "lu", "traite", "archive"];
const TAB_LABELS = { nouveau: "Nouveaux", lu: "Lus", traite: "Traités", archive: "Archivés" };
const STATUS_OPTIONS = STATUS_ORDER.map((value) => ({ value, label: MESSAGE_STATUS[value].label }));

function MessagePanel({ message, staff, onBack, onSaved, onDeleted }) {
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

  const staffOptions = staff.map((person) => ({
    value: String(person.id),
    label: `${person.name} — ${roleLabel(person.roles?.[0])}`,
  }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminApi.updateMessage(message.id, {
        status: form.status,
        assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
        notes: form.notes.trim() || null,
      });
      onSaved(updated);
      toast("Message mis à jour");
    } catch (err) {
      showError("Enregistrement impossible", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirmAction(
      "Supprimer ce message ?",
      `Le message de ${message.name} sera définitivement supprimé. Préférez l'archivage pour en garder une trace.`,
      "Supprimer",
      { danger: true }
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await adminApi.deleteMessage(message.id);
      onDeleted(message.id);
      toast("Message supprimé");
    } catch (err) {
      showError("Suppression impossible", getErrorMessage(err));
      setDeleting(false);
    }
  };

  const mailto = `mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`;

  return (
    <article className="adm-reader" aria-labelledby="adm-reader-title">
      <Button variant="ghost" size="sm" icon={ArrowLeft} className="adm-reader__back" onClick={onBack}>
        Retour à la liste
      </Button>
      <header className="adm-reader__head">
        <h2 id="adm-reader-title" ref={titleRef} tabIndex={-1}>{message.subject}</h2>
        <div className="adm-reader__meta">
          <strong>{message.name}</strong>
          <span>{message.email}</span>
          <span>{formatDateTime(message.created_at)}</span>
        </div>
      </header>

      <div className="adm-reader__content">{message.content}</div>

      <div className="row">
        <a className="btn" href={mailto}><Mail aria-hidden="true" /> Répondre par email</a>
        <span className="muted adm-small">Adresse : <span className="adm-mono">{message.email}</span></span>
      </div>

      <hr className="divider" />

      <div className="form-grid">
        <Select
          label="Statut"
          options={STATUS_OPTIONS}
          value={form.status}
          onChange={(event) => setForm({ ...form, status: event.target.value })}
        />
        <Select
          label="Assigné à"
          placeholder="Personne (non assigné)"
          options={staffOptions}
          value={form.assignedTo}
          onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}
        />
        <Textarea
          full
          label="Notes internes"
          hint="Visibles uniquement par l'équipe : suivi, réponse apportée, prochaine étape…"
          rows={4}
          maxLength={5000}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </div>

      <div className="row row--between adm-reader__actions">
        <Button variant="ghost" icon={Trash2} className="adm-danger-text" loading={deleting} onClick={remove}>
          Supprimer
        </Button>
        <Button icon={Save} loading={saving} disabled={!dirty} onClick={save}>Enregistrer</Button>
      </div>
      {message.handled_at && <p className="muted adm-small">Traité le {formatDateTime(message.handled_at)}.</p>}
    </article>
  );
}

function MessagesInbox() {
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.messages(), []);
  const { data: staff } = useAsync(() => adminApi.staff(), []);
  const [tab, setTab] = useState("nouveau");
  const [selectedId, setSelectedId] = useState(null);

  const messages = useMemo(() => data || [], [data]);
  const counts = useMemo(
    () => messages.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {}),
    [messages]
  );
  const visible = messages.filter((item) => item.status === tab);
  const selected = messages.find((item) => item.id === selectedId);

  const replace = (updated) => setData((list) => list.map((item) => (item.id === updated.id ? updated : item)));

  // Ouvrir un message nouveau le marque comme lu (le statut reste modifiable ensuite).
  const openMessage = async (message) => {
    setSelectedId(message.id);
    if (message.status !== "nouveau") return;
    try {
      replace(await adminApi.updateMessage(message.id, { status: "lu" }));
    } catch (err) {
      showError("Impossible de marquer le message comme lu", getErrorMessage(err));
    }
  };

  const header = (
    <PageHeader
      eyebrow="Relations"
      title="Messages"
      description="Les messages reçus via le formulaire de contact : lisez, répartissez dans l'équipe et suivez leur traitement."
    />
  );

  if (loading) return <>{header}<LoadingState label="Chargement des messages…" /></>;
  if (error) return <>{header}<ErrorState message={getErrorMessage(error)} onRetry={reload} /></>;

  return (
    <>
      {header}
      {!messages.length ? (
        <EmptyState
          icon={Inbox}
          title="Boîte de réception vide"
          description="Aucun message pour le moment. Les demandes envoyées depuis la page Contact arriveront ici."
        />
      ) : (
        <>
          <Tabs
            label="Statut des messages"
            value={tab}
            onChange={setTab}
            tabs={STATUS_ORDER.map((value) => ({ value, label: TAB_LABELS[value], count: counts[value] || 0 }))}
          />
          <div className={`adm-inbox${selected ? " has-selection" : ""}`}>
            <div className="adm-inbox__list">
              {visible.length === 0 ? (
                <EmptyState
                  icon={MailOpen}
                  title="Aucun message ici"
                  description={tab === "nouveau" ? "Tous les messages ont été lus. Bravo !" : "Aucun message n'a ce statut."}
                />
              ) : (
                <ul aria-label={`Messages : ${TAB_LABELS[tab].toLowerCase()}`}>
                  {visible.map((message) => (
                    <li key={message.id}>
                      <button
                        type="button"
                        className={`adm-mail${message.id === selectedId ? " is-active" : ""}${message.status === "nouveau" ? " is-unread" : ""}`}
                        aria-current={message.id === selectedId ? "true" : undefined}
                        onClick={() => openMessage(message)}
                      >
                        <span className="adm-mail__top">
                          <strong>{message.name}</strong>
                          <time dateTime={message.created_at}>{formatRelative(message.created_at)}</time>
                        </span>
                        <span className="adm-mail__subject">{message.subject}</span>
                        <span className="adm-mail__excerpt">{truncate(message.content, 90)}</span>
                        <span className="adm-mail__foot">
                          <StatusBadge status={statusOf(MESSAGE_STATUS, message.status)} />
                          {message.assigned_name && <span>→ {message.assigned_name}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="adm-inbox__panel">
              {selected ? (
                <MessagePanel
                  key={`${selected.id}-${selected.status}-${selected.assigned_to}-${selected.notes}`}
                  message={selected}
                  staff={staff || []}
                  onBack={() => setSelectedId(null)}
                  onSaved={replace}
                  onDeleted={(id) => {
                    setData((list) => list.filter((item) => item.id !== id));
                    setSelectedId(null);
                  }}
                />
              ) : (
                <EmptyState icon={Mail} title="Sélectionnez un message" description="Son contenu s'affichera ici, avec les outils de suivi." />
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
