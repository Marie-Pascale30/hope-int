"use client";

import "../../styles/public.css";
import { useMemo, useState } from "react";
import { CalendarDays, CalendarX, X } from "lucide-react";
import { Button, EmptyState, ErrorState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { EventCard, PublicHero } from "./components";
import EventsCalendar, { formatDayKey, formatMonthKey, indexEventsByDay, keyToDate, monthKey } from "./components/EventsCalendar";
import { plural } from "./components/helpers";

// Filtre actif : un jour ("AAAA-MM-JJ"), un mois ("AAAA-MM") ou rien (tout l'agenda).
function matchesFilter(event, filter, eventsByDay) {
  if (!filter) return true;
  if (filter.type === "day") return (eventsByDay.get(filter.key) || []).some((item) => item.id === event.id);
  return monthKey(new Date(event.start_at)) === filter.key;
}

function groupByMonth(events) {
  const groups = new Map();
  events.forEach((event) => {
    const key = monthKey(new Date(event.start_at));
    groups.set(key, [...(groups.get(key) || []), event]);
  });
  return [...groups.entries()];
}

export default function EventsView() {
  const { status } = useAuth();
  // Recharge une fois la session connue pour obtenir is_registered.
  const { data, loading, error, reload } = useAsync(() => publicApi.listEvents(), [status], { enabled: status !== "loading" });
  const [region, setRegion] = useState("");
  const [filter, setFilter] = useState(null);
  const [viewMonth, setViewMonth] = useState(null); // null = mois du premier evenement

  const events = useMemo(() => [...(data || [])].sort((a, b) => new Date(a.start_at) - new Date(b.start_at)), [data]);
  const regions = useMemo(() => [...new Set(events.map((e) => e.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [events]);
  const inRegion = useMemo(() => (region ? events.filter((e) => e.region === region) : events), [events, region]);
  const eventsByDay = useMemo(() => indexEventsByDay(inRegion), [inRegion]);
  const months = useMemo(() => groupByMonth(inRegion), [inRegion]);
  const visible = inRegion.filter((event) => matchesFilter(event, filter, eventsByDay));
  const pending = loading || status === "loading";

  const firstMonth = inRegion[0] ? new Date(new Date(inRegion[0].start_at).setDate(1)) : new Date(new Date().setDate(1));
  const shownMonth = viewMonth || new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1);

  const selectDay = (key) => setFilter(key ? { type: "day", key } : null);
  const selectMonth = (key) => {
    setFilter(filter?.type === "month" && filter.key === key ? null : { type: "month", key });
    setViewMonth(keyToDate(key));
  };
  const changeRegion = (value) => {
    setRegion(value);
    setFilter(null);
  };

  const filterLabel = filter?.type === "day"
    ? `Le ${formatDayKey(filter.key)}`
    : filter?.type === "month"
      ? `En ${formatMonthKey(filter.key)}`
      : null;

  return (
    <>
      <PublicHero
        eyebrow="Agenda"
        title="Nos prochains rendez-vous"
        lead="Ateliers de formation, journées de collecte, visites de terrain, assemblée générale : inscrivez-vous et venez agir à nos côtés."
      />
      <section className="section section--tight">
        <div className="container">
          {pending ? (
            <div className="pub-agenda" aria-busy="true" aria-label="Chargement de l’agenda">
              <div className="skeleton" style={{ height: 360 }} />
              <div className="pub-events">
                {[0, 1, 2].map((key) => <div key={key} className="skeleton" style={{ height: 120 }} />)}
              </div>
            </div>
          ) : error ? (
            <ErrorState message={getErrorMessage(error)} onRetry={reload} />
          ) : events.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title="Aucun événement programmé"
              description="De nouveaux rendez-vous seront bientôt annoncés. Suivez nos actualités ou rejoignez l’association pour être informé(e) en priorité."
              action={<Button href="/rejoindre">Nous rejoindre</Button>}
            />
          ) : (
            <div className="pub-agenda">
              <aside className="pub-agenda__side" aria-label="Calendrier des événements">
                <div className="card pub-agenda__panel">
                  <EventsCalendar
                    viewMonth={shownMonth}
                    onViewMonthChange={setViewMonth}
                    eventsByDay={eventsByDay}
                    selectedDay={filter?.type === "day" ? filter.key : null}
                    onSelectDay={selectDay}
                  />
                </div>

                {months.length > 0 && (
                  <div className="card pub-agenda__panel">
                    <h2 className="pub-agenda__subtitle">Mois à venir</h2>
                    <ul className="pub-agenda__months">
                      {months.map(([key, items]) => {
                        const active = filter?.type === "month" && filter.key === key;
                        return (
                          <li key={key}>
                            <button type="button" className={active ? "is-active" : undefined} aria-pressed={active} onClick={() => selectMonth(key)}>
                              <span className="pub-agenda__month-name">{formatMonthKey(key)}</span>
                              <span className="pub-agenda__month-count">{items.length}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {regions.length > 1 && (
                  <div className="card pub-agenda__panel">
                    <label className="pub-agenda__subtitle" htmlFor="events-region">Région</label>
                    <select id="events-region" className="select" value={region} onChange={(e) => changeRegion(e.target.value)}>
                      <option value="">Toutes les régions</option>
                      {regions.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                )}
              </aside>

              <div className="pub-agenda__main">
                <div className="pub-agenda__toolbar">
                  <p className="muted" style={{ margin: 0 }} aria-live="polite">
                    {filterLabel ? `${filterLabel} · ` : ""}
                    {plural(visible.length, "événement à venir", "événements à venir")}
                  </p>
                  {filter && (
                    <Button size="sm" variant="secondary" icon={X} onClick={() => setFilter(null)}>
                      Tout l’agenda
                    </Button>
                  )}
                </div>

                {visible.length === 0 ? (
                  <EmptyState
                    icon={CalendarX}
                    title={region ? "Aucun événement dans cette région" : "Aucun événement à cette date"}
                    description="Choisissez une autre date dans le calendrier ou consultez tout l’agenda."
                    action={<Button variant="secondary" onClick={() => changeRegion("")}>Voir tout l’agenda</Button>}
                  />
                ) : (
                  groupByMonth(visible).map(([key, items]) => (
                    <section key={key} className="pub-agenda__group" aria-labelledby={`agenda-${key}`}>
                      <h2 id={`agenda-${key}`} className="pub-agenda__month-title">
                        <CalendarDays size={20} aria-hidden="true" />
                        <span>{formatMonthKey(key)}</span>
                        <small>{plural(items.length, "événement", "événements")}</small>
                      </h2>
                      <div className="pub-events">
                        {items.map((event) => <EventCard key={event.id} event={event} />)}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
