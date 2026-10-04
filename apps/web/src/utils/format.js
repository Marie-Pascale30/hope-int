import { API_ORIGIN } from "../services/api";
import { INTL_LOCALES, TIME_ZONE } from "../i18n/config";

const LOCALE = "fr-FR";

function toDate(value) {
  if (!value) return null;
  // "2026-03-01" (colonne DATE) : interprete en date locale, sans decalage de fuseau.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Valeur pour <input type="datetime-local"> a partir d'une date ISO (heure locale).
export function toDateTimeLocalValue(value) {
  const date = toDate(value);
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Inverse : valeur datetime-local -> ISO UTC pour l'API.
export function fromDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

// Les images uploadees sont servies par le backend, les illustrations par le frontend (/images).
export function resolveImage(url) {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("/uploads/")) return `${API_ORIGIN}${url}`;
  return url;
}

export function initials(name = "") {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export function truncate(text = "", length = 160) {
  const value = String(text || "");
  return value.length > length ? `${value.slice(0, length).trimEnd()}…` : value;
}

// Enregistre un Blob (ex. export CSV) sous forme de fichier.
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Variantes par langue ----------
// Les fonctions ci-dessus formatent en francais (fuseau du navigateur) et restent utilisees
// par le back-office. Pour les vues traduites : getFormatters(locale) renvoie les memes
// formats dans la langue demandee, avec un fuseau fixe (identique serveur / client).
// Dans un composant : const f = useFormat() (src/i18n/format.js) ; f.date(value), f.money(12, "eur")...

export const DEFAULT_TIME_ZONE = TIME_ZONE;

export const toIntlLocale = (locale) => INTL_LOCALES[locale] || locale || LOCALE;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getFormatters(locale = "fr", { timeZone = DEFAULT_TIME_ZONE } = {}) {
  const tag = toIntlLocale(locale);

  // Une colonne DATE ("2026-03-01") n'a pas d'heure : formatee en UTC pour ne jamais changer de jour.
  const parse = (value) => {
    if (!value) return null;
    if (typeof value === "string" && DATE_ONLY_RE.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      return { date: new Date(Date.UTC(y, m - 1, d)), zone: "UTC" };
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : { date, zone: timeZone };
  };

  const formatWith = (value, options, empty = "—") => {
    const parsed = parse(value);
    return parsed ? new Intl.DateTimeFormat(tag, { timeZone: parsed.zone, ...options }).format(parsed.date) : empty;
  };

  // Cle "AAAA-MM-JJ" du jour dans le fuseau d'affichage.
  const dayKey = (value) => {
    const parsed = parse(value);
    if (!parsed) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone: parsed.zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed.date);
  };

  return {
    locale: tag,
    timeZone,
    number: (value, options) => new Intl.NumberFormat(tag, options).format(Number(value) || 0),
    money(amount, currency = "eur", { compact = false } = {}) {
      const value = Number(amount) || 0;
      const code = String(currency || "eur").toUpperCase();
      if (code === "XAF") return `${new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(value)} FCFA`;
      return new Intl.NumberFormat(tag, {
        style: "currency",
        currency: code,
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact || Number.isInteger(value) ? 0 : 2,
      }).format(value);
    },
    date: (value, options = { day: "numeric", month: "long", year: "numeric" }) => formatWith(value, options),
    shortDate: (value) => formatWith(value, { day: "2-digit", month: "2-digit", year: "numeric" }),
    dateTime: (value) => formatWith(value, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    time: (value) => formatWith(value, { hour: "2-digit", minute: "2-digit" }, ""),
    dayKey,
    monthKey: (value) => dayKey(value).slice(0, 7),
    // Formate une cle "AAAA-MM" ou "AAAA-MM-JJ" (sans decalage de fuseau).
    key(key, options = { day: "numeric", month: "long", year: "numeric" }) {
      if (!key) return "";
      const [y, m, d = 1] = String(key).split("-").map(Number);
      return new Intl.DateTimeFormat(tag, { timeZone: "UTC", ...options }).format(new Date(Date.UTC(y, m - 1, d)));
    },
    relative(value) {
      const parsed = parse(value);
      if (!parsed) return "—";
      const diff = (parsed.date.getTime() - Date.now()) / 1000;
      const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
      const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
      for (const [unit, seconds] of units) {
        if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
      }
      return rtf.format(0, "second");
    },
  };
}
