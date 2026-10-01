"use client";

// Graphique en barres (une seule serie) des montants mensuels en EUR.
// Charge uniquement cote client : importer ce fichier via next/dynamic ({ ssr: false }).
import { Bar, barDataset, baseOptions, CHART_SINGLE } from "../../../components/AdminCharts";
import { formatMonth } from "../../../utils/format";
import { formatEur, formatEurCompact } from "./finance";

export default function MonthlyChart({ months = [], label = "Montant collecté" }) {
  const data = {
    labels: months.map((row) => formatMonth(row.month)),
    datasets: [barDataset(label, months.map((row) => row.amountEur), CHART_SINGLE)],
  };
  const options = baseOptions({ format: formatEurCompact });
  options.plugins.tooltip.callbacks.label = (ctx) => ` ${formatEur(ctx.parsed.y)} · ${months[ctx.dataIndex]?.count || 0} don(s)`;

  return (
    <div className="chart-box">
      <Bar data={data} options={options} role="img" aria-label={`${label} par mois, en euros`} />
    </div>
  );
}
