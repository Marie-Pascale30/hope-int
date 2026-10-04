"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "../../../i18n/format";

const pad = (n) => String(n).padStart(2, "0");

// Cle "AAAA-MM-JJ" d'une date du calendrier (dates construites localement, sans heure).
export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function keyToDate(key) {
  const [y, m, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Jours couverts par chaque evenement (un evenement sur plusieurs jours marque chaque journee).
// f.dayKey : jour dans le fuseau d'affichage (Cameroun), identique cote serveur et client.
export function indexEventsByDay(events, f) {
  const index = new Map();
  events.forEach((event) => {
    const startKey = f.dayKey(event.start_at);
    const endKey = event.end_at ? f.dayKey(event.end_at) : startKey;
    if (!startKey) return;
    const cursor = keyToDate(startKey);
    for (let i = 0; i < 62; i += 1) {
      const key = dayKey(cursor);
      if (key > endKey) break;
      index.set(key, [...(index.get(key) || []), event]);
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return index;
}

// Noms des jours (semaine commencant le lundi) dans la langue courante : 1er janvier 2024 = lundi.
function weekdayNames(f) {
  return Array.from({ length: 7 }, (_, index) => {
    const key = `2024-01-${pad(index + 1)}`;
    return { short: f.key(key, { weekday: "narrow" }), long: f.key(key, { weekday: "long" }) };
  });
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

const addDays = (key, delta) => {
  const date = keyToDate(key);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
};

// Grille ARIA (role="grid") : un seul jour dans l'ordre de tabulation (roving tabindex).
// Fleches : jour / semaine ; Debut / Fin : debut / fin de semaine ; Page precedente / suivante : mois.
// Entree ou Espace sur un jour avec evenements : filtre l'agenda sur ce jour.
export default function EventsCalendar({ viewMonth, onViewMonthChange, eventsByDay, selectedDay, onSelectDay }) {
  const t = useTranslations("site.calendar");
  const f = useFormat();
  const weekdays = weekdayNames(f);
  const todayKey = f.dayKey(new Date());
  const days = buildMonthGrid(viewMonth);
  const keys = days.map(dayKey);
  const shiftMonth = (delta) => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
  const gridRef = useRef(null);
  const [focusedKey, setFocusedKey] = useState(null);
  const pendingFocus = useRef(false);

  // Jour actif : celui navigue au clavier s'il est affiche, sinon le jour choisi, aujourd'hui ou le 1er du mois.
  const inMonth = (key) => key && keyToDate(key).getMonth() === viewMonth.getMonth() && keys.includes(key);
  const activeKey = [focusedKey, selectedDay, todayKey].find(inMonth) || dayKey(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1));

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    gridRef.current?.querySelector(`[data-day="${activeKey}"]`)?.focus();
  });

  const moveTo = (key) => {
    const date = keyToDate(key);
    pendingFocus.current = true;
    setFocusedKey(key);
    if (date.getMonth() !== viewMonth.getMonth() || date.getFullYear() !== viewMonth.getFullYear()) {
      onViewMonthChange(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const onKeyDown = (event) => {
    const weekday = (keyToDate(activeKey).getDay() + 6) % 7;
    const moves = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
      Home: -weekday,
      End: 6 - weekday,
    };
    if (event.key in moves) {
      event.preventDefault();
      moveTo(addDays(activeKey, moves[event.key]));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const date = keyToDate(activeKey);
      const target = new Date(date.getFullYear(), date.getMonth() + (event.key === "PageDown" ? 1 : -1), 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(date.getDate(), lastDay));
      moveTo(dayKey(target));
    }
  };

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="pub-cal">
      <div className="pub-cal__head">
        <button type="button" className="pub-cal__nav" onClick={() => shiftMonth(-1)} aria-label={t("previousMonth")}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 className="pub-cal__title" id="pub-cal-title" aria-live="polite">{f.key(dayKey(viewMonth), { month: "long", year: "numeric" })}</h2>
        <button type="button" className="pub-cal__nav" onClick={() => shiftMonth(1)} aria-label={t("nextMonth")}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div
        ref={gridRef}
        className="pub-cal__grid"
        role="grid"
        aria-labelledby="pub-cal-title"
        aria-describedby="pub-cal-help"
        onKeyDown={onKeyDown}
      >
        <div role="row" className="pub-cal__row">
          {weekdays.map((day, index) => (
            <span key={index} className="pub-cal__weekday" role="columnheader" aria-label={day.long}>
              <span aria-hidden="true">{day.short}</span>
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={dayKey(week[0])} role="row" className="pub-cal__row">
            {week.map((date) => {
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
              const dayName = f.key(key, { weekday: "long", day: "numeric", month: "long" });
              const label = dayEvents.length ? t("dayWithEvents", { day: dayName, count: dayEvents.length }) : dayName;
              const common = {
                className: classes,
                "aria-label": label,
                "aria-current": key === todayKey ? "date" : undefined,
                "data-day": key,
                tabIndex: key === activeKey ? 0 : -1,
                onFocus: () => setFocusedKey(key),
              };

              return dayEvents.length > 0 ? (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  {...common}
                  aria-selected={selectedDay === key}
                  onClick={() => onSelectDay(selectedDay === key ? null : key)}
                >
                  <span aria-hidden="true">{date.getDate()}</span>
                  <span className="pub-cal__dots" aria-hidden="true">
                    {dayEvents.slice(0, 3).map((event) => <i key={event.id} />)}
                  </span>
                </button>
              ) : (
                <span key={key} role="gridcell" {...common}>
                  <span aria-hidden="true">{date.getDate()}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <p id="pub-cal-help" className="visually-hidden">
        {t("help")}
      </p>
      <div className="pub-cal__legend">
        <span><i className="pub-cal__legend-dot" aria-hidden="true" /> {t("legendEvents")}</span>
        <span><i className="pub-cal__legend-today" aria-hidden="true" /> {t("legendToday")}</span>
      </div>
    </div>
  );
}
