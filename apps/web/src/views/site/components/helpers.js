import { resolveImage } from "../../../utils/format";
import { API_ORIGIN } from "../../../services/api";

export const PLACEHOLDER = "/images/placeholder.svg";

export const imageSrc = (url) => resolveImage(url) || PLACEHOLDER;

// Pas d'optimisation next/image pour les SVG (servis tels quels) ni pour une API locale :
// l'optimiseur de Next refuse les adresses locales (localhost, reseau Docker).
const LOCAL_API = (() => {
  try {
    const { hostname } = new URL(API_ORIGIN);
    return /^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname) || !hostname.includes(".");
  } catch {
    return true;
  }
})();

export function isUnoptimizedImage(url) {
  if (!url) return true;
  if (url.split("?")[0].endsWith(".svg")) return true;
  return /^https?:\/\//.test(url) && url.startsWith(API_ORIGIN) && LOCAL_API;
}

export const cx = (...classes) => classes.filter(Boolean).join(" ");

export const isNotFound = (error) => error?.response?.status === 404;

// Un projet a une campagne active s'il a un objectif de collecte et n'est pas termine.
export const hasCampaign = (project) => Number(project?.goal_amount) > 0 && project?.status !== "termine";

export function campaignPercent(project) {
  if (project?.progress !== undefined && project?.progress !== null) return Number(project.progress) || 0;
  const goal = Number(project?.goal_amount) || 0;
  return goal ? Math.round(((Number(project?.raised_eur) || 0) / goal) * 100) : 0;
}

// Montant arrondi en euros dans la langue courante (f : getFormatters / useFormat).
export const euros = (f, amount) => f.money(Math.round(Number(amount) || 0), "eur");

// Places restantes d'un evenement -> { label, tone } pour un badge (t : useTranslations("site.spots")).
export function spotsStatus(event, t) {
  const remaining = event?.remaining_spots;
  if (remaining === null || remaining === undefined) return { label: t("free"), tone: "brand" };
  if (remaining <= 0) return { label: t("full"), tone: "danger" };
  if (remaining <= 5) return { label: t("fewLeft", { count: remaining }), tone: "warning" };
  return { label: t("left", { count: remaining }), tone: "info" };
}

export function eventTimeRange(event, f) {
  const start = f.time(event?.start_at);
  if (!event?.end_at) return start;
  const sameDay = f.dayKey(event.start_at) === f.dayKey(event.end_at);
  return sameDay ? `${start} – ${f.time(event.end_at)}` : `${start} → ${f.date(event.end_at)} ${f.time(event.end_at)}`;
}

export const isPast = (event) => {
  const end = new Date(event?.end_at || event?.start_at).getTime();
  return Number.isFinite(end) && end < Date.now();
};

// Decoupe un texte en paragraphes (lignes vides) ; les sauts simples sont conserves par .prose.
export const paragraphs = (text) =>
  String(text || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
