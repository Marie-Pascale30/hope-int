"use client";

// Calendrier, mois et region : filtrent la liste des evenements (rendue aussi cote serveur).
import { useMemo, useState } from "react";
import { CalendarDays, CalendarX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, EmptyState } from "../../../components/ui";
import { useFormat } from "../../../i18n/format";
import { EventCard } from ".";
import EventsCalendar, { indexEventsByDay, keyToDate } from "./EventsCalendar";

function groupByMonth(events, f) {
  const groups = new Map();
  events.forEach((event) => {
    const key = f.monthKey(event.start_at);
    groups.set(key, [...(groups.get(key) || []), event]);
  });
  return [...groups.entries()];
}

export default function EventsAgenda({ events }) {
  const t = useTranslations("site.events");
  const locale = useLocale();
  const f = useFormat();
  const [region, setRegion] = useState("");
  const [filter, setFilter] = useState(null); // { type: "day" | "month", key }
  const [viewMonth, setViewMonth] = useState(null); // null = mois du premier evenement

  const regions = useMemo(
    () => [...new Set(events.map((e) => e.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale)),
    [events, locale]
  );
  const inRegion = useMemo(() => (region ? events.filter((e) => e.region === region) : events), [events, region]);
  const eventsByDay = useMemo(() => indexEventsByDay(inRegion, f), [inRegion, f]);
  const months = useMemo(() => groupByMonth(inRegion, f), [inRegion, f]);
  const visible = inRegion.filter((event) => {
    if (!filter) return true;
    if (filter.type === "day") return (eventsByDay.get(filter.key) || []).some((item) => item.id === event.id);
    return f.monthKey(event.start_at) === filter.key;
  });

  const firstKey = inRegion[0] ? f.monthKey(inRegion[0].start_at) : f.monthKey(new Date());
  const shownMonth = viewMonth || keyToDate(firstKey);

  const selectDay = (key) => setFilter(key ? { type: "day", key } : null);
  const selectMonth = (key) => {
    setFilter(filter?.type === "month" && filter.key === key ? null : { type: "month", key });
    setViewMonth(keyToDate(key));
  };
  const changeRegion = (value) => {
    setRegion(value);
    setFilter(null);
  };

  const monthName = (key) => f.key(key, { month: "long", year: "numeric" });
  const filterLabel = filter?.type === "day"
    ? t("filterDay", { day: f.key(filter.key, { weekday: "long", day: "numeric", month: "long" }) })
    : filter?.type === "month"
      ? t("filterMonth", { month: monthName(filter.key) })
      : null;

  return (
    <div className="pub-agenda">
      <aside className="pub-agenda__side" aria-label={t("calendarLabel")}>
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
            <h2 className="pub-agenda__subtitle">{t("upcomingMonths")}</h2>
            <ul className="pub-agenda__months">
              {months.map(([key, items]) => {
                const active = filter?.type === "month" && filter.key === key;
                return (
                  <li key={key}>
                    <button type="button" className={active ? "is-active" : undefined} aria-pressed={active} onClick={() => selectMonth(key)}>
                      <span className="pub-agenda__month-name">{monthName(key)}</span>
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
            <label className="pub-agenda__subtitle" htmlFor="events-region">{t("region")}</label>
            <select id="events-region" className="select" value={region} onChange={(e) => changeRegion(e.target.value)}>
              <option value="">{t("allRegions")}</option>
              {regions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}
      </aside>

      <div className="pub-agenda__main">
        <div className="pub-agenda__toolbar">
          <p className="muted" style={{ margin: 0 }} aria-live="polite">
            {filterLabel ? `${filterLabel} · ` : ""}
            {t("count", { count: visible.length })}
          </p>
          {filter && (
            <Button size="sm" variant="secondary" icon={X} onClick={() => setFilter(null)}>
              {t("showAll")}
            </Button>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={CalendarX}
            title={region ? t("noneInRegion") : t("noneOnDate")}
            description={t("noneText")}
            action={<Button variant="secondary" onClick={() => changeRegion("")}>{t("showAll")}</Button>}
          />
        ) : (
          groupByMonth(visible, f).map(([key, items]) => (
            <section key={key} className="pub-agenda__group" aria-labelledby={`agenda-${key}`}>
              <h2 id={`agenda-${key}`} className="pub-agenda__month-title">
                <CalendarDays size={20} aria-hidden="true" />
                <span>{monthName(key)}</span>
                <small>{t("monthCount", { count: items.length })}</small>
              </h2>
              <div className="pub-events">
                {items.map((event) => <EventCard key={event.id} event={event} />)}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
