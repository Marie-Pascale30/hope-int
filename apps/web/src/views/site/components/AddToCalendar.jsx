"use client";

// "Ajouter a mon agenda" : fichier .ics (iCalendar, RFC 5545) genere dans le navigateur.
// Heures exprimees dans le fuseau Africa/Douala (UTC+1, sans heure d'ete), avec sa definition
// VTIMEZONE pour les agendas qui ne la connaissent pas. Sans heure de fin : 2 heures par defaut.
import { CalendarPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui";
import { saveBlob } from "@/src/utils/format";

const TIME_ZONE = "Africa/Douala";
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

// Date -> "20261012T143000" (heure locale de Douala).
function localStamp(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

const utcStamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Echappement des textes (\\, ;, , et retours a la ligne) puis repli des lignes a 75 octets environ.
const escapeText = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line) {
  const chunks = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

export function buildIcs(event, url) {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : new Date(start.getTime() + DEFAULT_DURATION_MS);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HOPE International//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    `TZID:${TIME_ZONE}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0100",
    "TZNAME:WAT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@hope-international`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART;TZID=${TIME_ZONE}:${localStamp(start)}`,
    `DTEND;TZID=${TIME_ZONE}:${localStamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    `DESCRIPTION:${escapeText([event.description, url].filter(Boolean).join("\n\n"))}`,
    url ? `URL:${url}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

const slug = (text) => String(text || "evenement").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "evenement";

// path : chemin localise de la fiche (ajoute a la description de l'evenement).
export default function AddToCalendar({ event, path }) {
  const t = useTranslations("site.eventDetail.calendar");

  const download = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : SITE_URL;
    const ics = buildIcs(event, path ? `${origin}${path}` : "");
    saveBlob(new Blob([ics], { type: "text/calendar;charset=utf-8" }), `${slug(event.title)}.ics`);
  };

  return (
    <Button variant="secondary" size="sm" icon={CalendarPlus} onClick={download}>
      {t("add")}
    </Button>
  );
}
