import { API_ORIGIN } from "../services/api";

const LOCALE = "fr-FR";

export function formatMoney(amount, currency = "eur", { compact = false } = {}) {
  const value = Number(amount) || 0;
  const code = String(currency || "eur").toUpperCase();
  if (code === "XAF") {
    return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value)} FCFA`;
  }
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: code,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact || Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatNumber(value, options) {
  return new Intl.NumberFormat(LOCALE, options).format(Number(value) || 0);
}

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

export function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(LOCALE, options).format(date) : "—";
}

export function formatShortDate(value) {
  return formatDate(value, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)
    : "—";
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" }).format(date) : "";
}

export function formatMonth(value) {
  // "2026-03" -> "mars 2026"
  if (!value) return "";
  const [y, m] = String(value).split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, { month: "short", year: "2-digit" }).format(new Date(y, m - 1, 1));
}

export function formatRelative(value) {
  const date = toDate(value);
  if (!date) return "—";
  const diff = (date.getTime() - Date.now()) / 1000;
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return "à l'instant";
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
