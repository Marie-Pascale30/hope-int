"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, Clock, ExternalLink, FolderHeart, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, ErrorState, PageSkeleton, PageHeader, ProgressBar, TabPanel, Tabs } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { useFormat } from "../../i18n/format";
import { useLocalePath } from "../../i18n/navigation";
import { adminApi, publicApi } from "../../services";
import { useErrorMessage } from "../../i18n/errors";
import { useAlerts } from "../../utils/alerts";
import { PERMISSIONS as P } from "../../utils/rbac";
import EventForm from "./parts-b/EventForm";
import EventRegistrations from "./parts-b/EventRegistrations";

const isPast = (event) => new Date(event.end_at || event.start_at).getTime() < Date.now();

function EventRow({ event, past, onEdit, onRegistrations, onDelete, busy }) {
  const t = useTranslations("adminOps.events");
  const f = useFormat();
  const lp = useLocalePath();
  const registered = Number(event.registered_count) || 0;
  const fill = event.capacity ? Math.round((registered / event.capacity) * 100) : 0;
  const sameDay = event.end_at && f.dayKey(event.end_at) === f.dayKey(event.start_at);
  const startLabel = t("when", {
    date: f.date(event.start_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    time: f.time(event.start_at),
  });
  const endLabel = event.end_at
    ? sameDay
      ? ` – ${f.time(event.end_at)}`
      : ` → ${t("when", { date: f.date(event.end_at), time: f.time(event.end_at) })}`
    : "";

  return (
    <article className={`adm-event-card${past ? " adm-event-card--past" : ""}`}>
      <div className="adm-datebox" aria-hidden="true">
        <strong>{f.date(event.start_at, { day: "numeric" })}</strong>
        <span>{f.date(event.start_at, { month: "short" }).replace(".", "")}</span>
        <span>{f.date(event.start_at, { year: "numeric" })}</span>
      </div>

      <div>
        <h2 className="adm-event-card__title">
          {event.title}
          {!event.published && <Badge>{t("draft")}</Badge>}
          {past && <Badge plain>{t("pastBadge")}</Badge>}
        </h2>
        <div className="adm-event-card__meta">
          <span>
            <Clock aria-hidden="true" />
            {startLabel}
            {endLabel}
          </span>
          <span><MapPin aria-hidden="true" />{event.location}{event.region ? ` · ${event.region}` : ""}</span>
          {event.project_title && <span><FolderHeart aria-hidden="true" />{event.project_title}</span>}
        </div>
      </div>

      <div className="adm-event-card__spots">
        {event.capacity ? (
          <>
            <ProgressBar value={fill} accent={fill >= 90} label={t("fillRate", { fill })} />
            <div className="progress-meta">
              <span>
                {t.rich("registeredOf", {
                  count: registered,
                  capacity: f.number(event.capacity),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </span>
              <span>{event.remaining_spots === 0 ? t("full") : t("spotsLeft", { count: Number(event.remaining_spots) || 0 })}</span>
            </div>
          </>
        ) : (
          <div className="progress-meta" style={{ marginTop: 0 }}>
            <span>{t.rich("registered", { count: registered, strong: (chunks) => <strong>{chunks}</strong> })}</span>
            <span>{t("unlimited")}</span>
          </div>
        )}
      </div>

      <div className="adm-actions">
        <Button size="sm" variant="secondary" icon={Users} onClick={() => onRegistrations(event)}>{t("registrations")}</Button>
        <Button
          size="sm"
          variant="ghost"
          icon={Pencil}
          onClick={() => onEdit(event)}
          aria-label={t("editNamed", { name: event.title })}
          title={t("edit")}
        />
        {event.published && !past && (
          <Button
            size="sm"
            variant="ghost"
            icon={ExternalLink}
            href={lp(`/evenements/${event.id}`)}
            target="_blank"
            aria-label={t("viewNamed", { name: event.title })}
            title={t("view")}
          />
        )}
        <Button
          size="sm"
          variant="ghost"
          icon={Trash2}
          disabled={busy}
          onClick={() => onDelete(event)}
          aria-label={t("deleteNamed", { name: event.title })}
          title={t("delete")}
        />
      </div>
    </article>
  );
}

function EventsView() {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.events");
  const { confirmAction, showError, toast } = useAlerts();
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
    const ok = await confirmAction(
      t("deleteConfirm.title", { name: event.title }),
      registered ? t("deleteConfirm.withRegistrations", { count: registered }) : t("deleteConfirm.text"),
      t("delete"),
      { danger: true }
    );
    if (!ok) return;
    setBusyId(event.id);
    try {
      await adminApi.deleteEvent(event.id);
      setData((prev) => prev.filter((row) => row.id !== event.id));
      toast(t("deleted"));
    } catch (err) {
      showError(t("deleteFailed"), getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const createButton = <Button icon={Plus} onClick={() => setEditing({ event: null })}>{t("create")}</Button>;

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} actions={createButton} />

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <PageSkeleton variant="list" rows={4} label={t("loading")} />
      ) : (
        <>
          <Tabs
            id="events-tabs"
            tabs={[
              { value: "upcoming", label: t("tabs.upcoming"), count: upcoming.length },
              { value: "past", label: t("tabs.past"), count: past.length },
            ]}
            value={tab}
            onChange={setTab}
            label={t("tabs.label")}
          />
          <TabPanel tabsId="events-tabs" value={tab}>
          {list.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon={CalendarDays}
                title={tab === "upcoming" ? t("empty.upcomingTitle") : t("empty.pastTitle")}
                description={tab === "upcoming" ? t("empty.upcomingText") : t("empty.pastText")}
                action={tab === "upcoming" && createButton}
              />
            </div>
          ) : (
            <div className="adm-event-list">
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
          </TabPanel>
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
