"use client";

import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { readCssToken, useResolvedTheme } from "../utils/theme";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

ChartJS.defaults.font.family = '"Inter Variable", "Inter", system-ui, sans-serif';
ChartJS.defaults.font.size = 12;

// Couleurs lues dans les tokens CSS (--chart-*, globals.css) : elles suivent le theme clair / sombre.
// Palette categorielle validee (daltonisme, contraste sur la surface) dans les deux themes.
// Ordre fixe, jamais cycle : une serie garde toujours la meme couleur. Au-dela de 3 series, regrouper en "Autres".
// Les valeurs de repli correspondent au theme clair (rendu serveur, tests).
const FALLBACK = {
  series: ["#1f8a5f", "#2f74b5", "#d2772a", "#7b5cc4", "#c2477a", "#8a7a1a"],
  grid: "#efe9df",
  ink: "#1c2421",
  muted: "#5f6863",
  tooltipBg: "#14261f",
  tooltipInk: "#ffffff",
  surface: "#ffffff",
};

export function readChartTheme() {
  return {
    series: FALLBACK.series.map((color, index) => readCssToken(`--chart-${index + 1}`, color)),
    grid: readCssToken("--chart-grid", FALLBACK.grid),
    ink: readCssToken("--chart-ink", FALLBACK.ink),
    muted: readCssToken("--chart-muted", FALLBACK.muted),
    tooltipBg: readCssToken("--chart-tooltip-bg", FALLBACK.tooltipBg),
    tooltipInk: readCssToken("--chart-tooltip-ink", FALLBACK.tooltipInk),
    surface: readCssToken("--surface", FALLBACK.surface),
  };
}

// Couleurs du theme courant ; le composant appelant se re-rend a chaque changement de theme.
export function useChartTheme() {
  const mode = useResolvedTheme();
  return { mode, ...readChartTheme() };
}

// Compatibilite : couleurs du theme clair (preferer useChartTheme().series).
export const CHART_COLORS = FALLBACK.series.slice(0, 3);
export const CHART_SINGLE = FALLBACK.series[0];

// Separateur "serie : valeur" de l'infobulle : espace avant les deux-points en francais seulement
// (langue lue sur <html lang>, les graphiques ne sont rendus que cote client).
function labelSeparator() {
  const lang = typeof document === "undefined" ? "fr" : document.documentElement.lang || "fr";
  return lang.toLowerCase().startsWith("fr") ? " : " : ": ";
}

// Options de base : grille discrete, un seul axe Y, infobulle au survol.
// `format` met en forme les valeurs (axe + infobulle) ; `theme` vient de useChartTheme().
export function baseOptions({ format = (v) => v, legend = false, stacked = false, theme = readChartTheme() } = {}) {
  const separator = labelSeparator();
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    color: theme.muted,
    plugins: {
      legend: { display: legend, position: "bottom", labels: { usePointStyle: true, boxWidth: 8, color: theme.ink, padding: 16 } },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        padding: 10,
        cornerRadius: 8,
        titleColor: theme.tooltipInk,
        bodyColor: theme.tooltipInk,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label ? `${ctx.dataset.label}${separator}` : ""}${format(ctx.parsed.y ?? ctx.parsed)}`,
        },
      },
    },
    scales: {
      x: { stacked, grid: { display: false }, border: { color: theme.grid }, ticks: { color: theme.muted } },
      y: {
        stacked,
        beginAtZero: true,
        grid: { color: theme.grid },
        border: { display: false },
        ticks: { color: theme.muted, callback: (value) => format(value), maxTicksLimit: 6 },
      },
    },
  };
}

// Barres fines, extremites arrondies (4px) cote donnees, 2px d'espace (couleur de la surface) entre barres.
export const barDataset = (label, data, color, theme = readChartTheme()) => ({
  label,
  data,
  backgroundColor: color || theme.series[0],
  hoverBackgroundColor: color || theme.series[0],
  borderRadius: { topLeft: 4, topRight: 4 },
  borderSkipped: "bottom",
  borderColor: theme.surface,
  borderWidth: 1,
  maxBarThickness: 28,
  categoryPercentage: 0.7,
});

// Courbe 2px, points de 8px au survol uniquement.
export const lineDataset = (label, data, color, { fill = true, theme = readChartTheme() } = {}) => {
  const stroke = color || theme.series[0];
  return {
    label,
    data,
    borderColor: stroke,
    // Remplissage a 12 % d'opacite (tokens en hexadecimal #rrggbb).
    backgroundColor: fill && /^#[0-9a-f]{6}$/i.test(stroke) ? `${stroke}1f` : stroke,
    fill,
    borderWidth: 2,
    tension: 0.3,
    pointRadius: 0,
    pointHoverRadius: 5,
    pointHitRadius: 12,
    pointBackgroundColor: stroke,
    pointBorderColor: theme.surface,
    pointBorderWidth: 2,
  };
};

export { Bar, Doughnut, Line };
