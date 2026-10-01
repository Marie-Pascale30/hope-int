"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const WEEKDAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const monthTitle = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dayTitle = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

const pad = (n) => String(n).padStart(2, "0");

// Cle locale "AAAA-MM-JJ" (l'agenda raisonne en jours du fuseau du visiteur).
export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export function keyToDate(key) {
  const [y, m, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const formatMonthKey = (key) => monthTitle.format(keyToDate(key));
export const formatDayKey = (key) => dayTitle.format(keyToDate(key));

// Jours couverts par chaque evenement (un evenement sur plusieurs jours marque chaque journee).
export function indexEventsByDay(events) {
  const index = new Map();
  events.forEach((event) => {
    const start = new Date(event.start_at);
    const end = event.end_at ? new Date(event.end_at) : start;
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    for (let i = 0; i < 62 && cursor <= end; i += 1) {
      const key = dayKey(cursor);
      index.set(key, [...(index.get(key) || []), event]);
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return index;
}

// Grille du mois (semaines commencant le lundi), completee par les jours des mois voisins.
function buildMonthGrid(viewMonth) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push(date);
  }
  // Supprime la derniere semaine si elle appartient entierement au mois suivant.
  return days[35].getMonth() !== viewMonth.getMonth() ? days.slice(0, 35) : days;
}

export default function EventsCalendar({ viewMonth, onViewMonthChange, eventsByDay, selectedDay, onSelectDay }) {
  const todayKey = dayKey(new Date());
  const days = buildMonthGrid(viewMonth);
  const shiftMonth = (delta) => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));

  return (
    <div className="pub-cal">
      <div className="pub-cal__head">
        <button type="button" className="pub-cal__nav" onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 className="pub-cal__title" aria-live="polite">{monthTitle.format(viewMonth)}</h2>
        <button type="button" className="pub-cal__nav" onClick={() => shiftMonth(1)} aria-label="Mois suivant">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="pub-cal__grid" role="grid" aria-label={`Calendrier ${monthTitle.format(viewMonth)}`}>
        {WEEKDAYS.map((label, index) => (
          <span key={`${label}-${index}`} className="pub-cal__weekday" role="columnheader" aria-label={WEEKDAY_NAMES[index]}>
            {label}
          </span>
        ))}
        {days.map((date) => {
          const key = dayKey(date);
          const dayEvents = eventsByDay.get(key) || [];
          const outside = date.getMonth() !== viewMonth.getMonth();
          const past = key < todayKey;
          const classes = [
            "pub-cal__day",
            outside && "is-outside",
            past && "is-past",
            key === todayKey && "is-today",
            dayEvents.length > 0 && "has-events",
            selectedDay === key && "is-selected",
          ].filter(Boolean).join(" ");
          const label = `${dayTitle.format(date)}${dayEvents.length ? ` : ${dayEvents.length} événement${dayEvents.length > 1 ? "s" : ""}` : ""}`;

          return dayEvents.length > 0 ? (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={classes}
              aria-label={label}
              aria-selected={selectedDay === key}
              onClick={() => onSelectDay(selectedDay === key ? null : key)}
            >
              <span>{date.getDate()}</span>
              <span className="pub-cal__dots" aria-hidden="true">
                {dayEvents.slice(0, 3).map((event) => <i key={event.id} />)}
              </span>
            </button>
          ) : (
            <span key={key} role="gridcell" className={classes} aria-label={label}>
              <span>{date.getDate()}</span>
            </span>
          );
        })}
      </div>

      <div className="pub-cal__legend">
        <span><i className="pub-cal__legend-dot" aria-hidden="true" /> Jour avec événement</span>
        <span><i className="pub-cal__legend-today" aria-hidden="true" /> Aujourd’hui</span>
      </div>
    </div>
  );
}
