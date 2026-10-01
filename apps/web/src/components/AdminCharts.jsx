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

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

ChartJS.defaults.font.family = '"Inter Variable", "Inter", system-ui, sans-serif';
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = "#78827d";

// Palette categorielle validee (daltonisme, contraste sur fond blanc). Ordre fixe, jamais cycle :
// une serie garde toujours la meme couleur. Au-dela de 3 series, regrouper en "Autres".
export const CHART_COLORS = ["#1f8a5f", "#2f74b5", "#d2772a"];
export const CHART_SINGLE = "#1f8a5f";
const GRID = "#efe9df";
const INK = "#1c2421";

// Options de base : grille discrete, un seul axe Y, infobulle au survol.
// `format` met en forme les valeurs (axe + infobulle).
export function baseOptions({ format = (v) => v, legend = false, stacked = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: legend, position: "bottom", labels: { usePointStyle: true, boxWidth: 8, color: INK, padding: 16 } },
      tooltip: {
        backgroundColor: "#14261f",
        padding: 10,
        cornerRadius: 8,
        titleColor: "#fff",
        bodyColor: "#fff",
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label ? `${ctx.dataset.label} : ` : ""}${format(ctx.parsed.y ?? ctx.parsed)}`,
        },
      },
    },
    scales: {
      x: { stacked, grid: { display: false }, border: { color: GRID }, ticks: { color: "#78827d" } },
      y: {
        stacked,
        beginAtZero: true,
        grid: { color: GRID },
        border: { display: false },
        ticks: { color: "#78827d", callback: (value) => format(value), maxTicksLimit: 6 },
      },
    },
  };
}

// Barres fines, extremites arrondies (4px) cote donnees, 2px d'espace entre barres.
export const barDataset = (label, data, color = CHART_SINGLE) => ({
  label,
  data,
  backgroundColor: color,
  hoverBackgroundColor: color,
  borderRadius: { topLeft: 4, topRight: 4 },
  borderSkipped: "bottom",
  borderColor: "#ffffff",
  borderWidth: 1,
  maxBarThickness: 28,
  categoryPercentage: 0.7,
});

// Courbe 2px, points de 8px au survol uniquement.
export const lineDataset = (label, data, color = CHART_SINGLE, { fill = true } = {}) => ({
  label,
  data,
  borderColor: color,
  backgroundColor: fill ? `${color}1f` : color,
  fill,
  borderWidth: 2,
  tension: 0.3,
  pointRadius: 0,
  pointHoverRadius: 5,
  pointHitRadius: 12,
  pointBackgroundColor: color,
  pointBorderColor: "#ffffff",
  pointBorderWidth: 2,
});

export { Bar, Doughnut, Line };
