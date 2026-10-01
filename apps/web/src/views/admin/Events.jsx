"use client";

import "../../styles/admin-b.css";
import { useCallback, useMemo, useState } from "react";
import { CalendarDays, Clock, ExternalLink, FolderHeart, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, Tabs } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { adminApi, publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatDate, formatNumber, formatTime } from "../../utils/format";
import { confirmAction, showError, toast } from "../../utils/alerts";
import { PERMISSIONS as P } from "../../utils/rbac";
import EventForm from "./parts-b/EventForm";
import EventRegistrations from "./parts-b/EventRegistrations";

const isPast = (event) => new Date(event.end_at || event.start_at).getTime() < Date.now();

function EventRow({ event, past, onEdit, onRegistrations, onDelete, busy }) {
  const start = new Date(event.start_at);
  const registered = Number(event.registered_count) || 0;
  const fill = event.capacity ? Math.round((registered / event.capacity) * 100) : 0;
  const sameDay = event.end_at && formatDate(event.end_at) === formatDate(event.start_at);

  return (
    <article className={`admb-event${past ? " admb-event--past" : ""}`}>
      <div className="admb-datebox" aria-hidden="true">
        <strong>{start.getDate()}</strong>
        <span>{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(start).replace(".", "")}</span>
        <span>{start.getFullYear()}</span>
      </div>

      <div>
        <h2 className="admb-event__title">
          {event.title}
          {!event.published && <Badge>Brouillon</Badge>}
          {past && <Badge plain>Passé</Badge>}
        </h2>
        <div className="admb-event__meta">
          <span>
            <Clock aria-hidden="true" />
            {formatDate(event.start_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {formatTime(event.start_at)}
            {event.end_at && (sameDay ? ` – ${formatTime(event.end_at)}` : ` → ${formatDate(event.end_at)} ${formatTime(event.end_at)}`)}
          </span>
          <span><MapPin aria-hidden="true" />{event.location}{event.region ? ` · ${event.region}` : ""}</span>
          {event.project_title && <span><FolderHeart aria-hidden="true" />{event.project_title}</span>}
        </div>
      </div>

      <div className="admb-event__spots">
        {event.capacity ? (
          <>
            <ProgressBar value={fill} accent={fill >= 90} label={`Taux de remplissage : ${fill} %`} />
            <div className="progress-meta">
              <span><strong>{formatNumber(registered)}</strong> / {formatNumber(event.capacity)} inscrits</span>
              <span>{event.remaining_spots === 0 ? "Complet" : `${formatNumber(event.remaining_spots)} place(s)`}</span>
            </div>
          </>
        ) : (
          <div className="progress-meta" style={{ marginTop: 0 }}>
            <span><strong>{formatNumber(registered)}</strong> inscrit(s)</span>
            <span>Places illimitées</span>
          </div>
        )}
      </div>

      <div className="admb-actions">
        <Button size="sm" variant="secondary" icon={Users} onClick={() => onRegistrations(event)}>Inscrits</Button>
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onEdit(event)} aria-label={`Modifier « ${event.title} »`} title="Modifier" />
        {event.published && !past && (
          <Button
            size="sm"
            variant="ghost"
            icon={ExternalLink}
            href={`/evenements/${event.id}`}
            target="_blank"
            aria-label={`Voir « ${event.title} » sur le site`}
            title="Voir sur le site"
          />
        )}
        <Button
          size="sm"
          variant="ghost"
          icon={Trash2}
          disabled={busy}
          onClick={() => onDelete(event)}
          aria-label={`Supprimer « ${event.title} »`}
          title="Supprimer"
        />
      </div>
    </article>
  );
}

function EventsView() {
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.events(), []);
  // Liste publique des projets : accessible a toutes les personnes qui gerent les evenements.
  const { data: projects } = useAsync(() => publicApi.listContent("projects"), []);
  const [tab, setTab] = useState("upcoming");
  const [editing, setEditing] = useState(null); // null | { event } (event null = creation)
  const [viewing, setViewing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const { upcoming, past } = useMemo(() => {
    const events = data || [];
    return {
      upcoming: events.filter((event) => !isPast(event)).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)),
      past: events.filter(isPast).sort((a, b) => new Date(b.start_at) - new Date(a.start_at)),
    };
  }, [data]);
  const list = tab === "upcoming" ? upcoming : past;

  const closeForm = useCallback(() => setEditing(null), []);
  const closeRegistrations = useCallback(() => setViewing(null), []);

  const onSaved = (saved, isUpdate) => {
    setData((prev) => (isUpdate ? prev.map((row) => (row.id === saved.id ? saved : row)) : [saved, ...(prev || [])]));
    setEditing(null);
  };

  const remove = async (event) => {
    const registered = Number(event.registered_count) || 0;
    const warning = registered
      ? `Les ${registered} inscription(s) seront supprimées avec lui. Pensez à prévenir les participants.`
      : "Cette suppression est définitive.";
    const ok = await confirmAction(`Supprimer « ${event.title} » ?`, warning, "Supprimer", { danger: true });
    if (!ok) return;
    setBusyId(event.id);
    try {
      await adminApi.deleteEvent(event.id);
      setData((prev) => prev.filter((row) => row.id !== event.id));
      toast("Événement supprimé");
    } catch (err) {
      showError("Suppression impossible", getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Contenus"
        title="Événements"
        description="Ateliers, collectes, visites de terrain : planifiez vos rendez-vous et suivez les inscriptions."
        actions={<Button icon={Plus} onClick={() => setEditing({ event: null })}>Nouvel événement</Button>}
      />

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState label="Chargement des événements…" />
      ) : (
        <>
          <Tabs
            tabs={[
              { value: "upcoming", label: "À venir", count: upcoming.length },
              { value: "past", label: "Passés", count: past.length },
            ]}
            value={tab}
            onChange={setTab}
            label="Période des événements"
          />
          {list.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon={CalendarDays}
                title={tab === "upcoming" ? "Aucun événement à venir" : "Aucun événement passé"}
                description={
                  tab === "upcoming"
                    ? "Programmez un atelier ou une collecte : les membres pourront s'y inscrire depuis le site."
                    : "Les événements terminés apparaîtront ici avec leur nombre de participants."
                }
                action={tab === "upcoming" && <Button icon={Plus} onClick={() => setEditing({ event: null })}>Nouvel événement</Button>}
              />
            </div>
          ) : (
            <div className="admb-events">
              {list.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  past={tab === "past"}
                  busy={busyId === event.id}
                  onEdit={(item) => setEditing({ event: item })}
                  onRegistrations={setViewing}
                  onDelete={remove}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editing && <EventForm event={editing.event} projects={projects || []} onClose={closeForm} onSaved={onSaved} />}
      {viewing && <EventRegistrations event={viewing} onClose={closeRegistrations} />}
    </>
  );
}

export default function Events() {
  return (
    <RequireAuth permission={P.MANAGE_ORGANIZATION}>
      <EventsView />
    </RequireAuth>
  );
}
