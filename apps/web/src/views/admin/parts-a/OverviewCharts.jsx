"use client";

// Graphiques de la vue d'ensemble (charge via next/dynamic, ssr: false).
import { Bar, Line, baseOptions, barDataset, lineDataset } from "../../../components/AdminCharts";
import { formatMoney, formatNumber } from "../../../utils/format";

const moneyFormat = (value) => formatMoney(value, "eur", { compact: value >= 10000 });
const countFormat = (value) => formatNumber(value);

export function DonationsChart({ labels, values }) {
  return (
    <div className="chart-box" role="img" aria-label="Montant des dons par mois sur 12 mois, en euros">
      <Bar data={{ labels, datasets: [barDataset("Dons", values)] }} options={baseOptions({ format: moneyFormat })} />
    </div>
  );
}

export function MembersChart({ labels, values }) {
  const options = baseOptions({ format: countFormat });
  options.scales.y.ticks.precision = 0;
  return (
    <div className="chart-box" role="img" aria-label="Nombre de nouveaux membres inscrits par mois sur 12 mois">
      <Line data={{ labels, datasets: [lineDataset("Nouveaux membres", values)] }} options={options} />
    </div>
  );
}
