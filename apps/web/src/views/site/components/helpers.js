import { formatDate, formatMoney, formatTime, resolveImage } from "../../../utils/format";

export const PLACEHOLDER = "/images/placeholder.svg";

export const imageSrc = (url) => resolveImage(url) || PLACEHOLDER;

export const cx = (...classes) => classes.filter(Boolean).join(" ");

// Accord simple : 0 ou 1 -> singulier, sinon pluriel.
export function plural(count, singular, pluralForm = `${singular}s`) {
  const n = Number(count) || 0;
  return `${new Intl.NumberFormat("fr-FR").format(n)} ${n > 1 ? pluralForm : singular}`;
}

export const euros = (amount) => formatMoney(Math.round(Number(amount) || 0), "eur");

export const isNotFound = (error) => error?.response?.status === 404;

// Un projet a une campagne active s'il a un objectif de collecte et n'est pas termine.
export const hasCampaign = (project) => Number(project?.goal_amount) > 0 && project?.status !== "termine";

export function campaignPercent(project) {
  if (project?.progress !== undefined && project?.progress !== null) return Number(project.progress) || 0;
  const goal = Number(project?.goal_amount) || 0;
  return goal ? Math.round(((Number(project?.raised_eur) || 0) / goal) * 100) : 0;
}

// Places restantes d'un evenement -> { label, tone } pour un badge.
export function spotsStatus(event) {
  const remaining = event?.remaining_spots;
  if (remaining === null || remaining === undefined) return { label: "Entrée libre", tone: "brand" };
  if (remaining <= 0) return { label: "Complet", tone: "danger" };
  if (remaining <= 5) return { label: `Plus que ${plural(remaining, "place")}`, tone: "warning" };
  return { label: `${plural(remaining, "place restante", "places restantes")}`, tone: "info" };
}

export function eventTimeRange(event) {
  const start = formatTime(event?.start_at);
  if (!event?.end_at) return start;
  const sameDay = formatDate(event.start_at) === formatDate(event.end_at);
  return sameDay ? `${start} – ${formatTime(event.end_at)}` : `${start} → ${formatDate(event.end_at)} ${formatTime(event.end_at)}`;
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
