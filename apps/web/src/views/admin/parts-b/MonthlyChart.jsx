"use client";

// Graphique en barres (une seule serie) des montants mensuels en EUR.
// Charge uniquement cote client : importer ce fichier via next/dynamic ({ ssr: false }).
import { useTranslations } from "next-intl";
import { Bar, barDataset, baseOptions, useChartTheme } from "../../../components/AdminCharts";
import { useFormat } from "../../../i18n/format";
import { formatEur, formatEurCompact, formatMonthKey } from "./finance";

export default function MonthlyChart({ months = [], label }) {
  const t = useTranslations("adminOps.charts");
  const f = useFormat();
  const theme = useChartTheme();
  const seriesLabel = label || t("collected");
  const data = {
    labels: months.map((row) => formatMonthKey(f, row.month)),
    datasets: [barDataset(seriesLabel, months.map((row) => row.amountEur), theme.series[0], theme)],
  };
  const options = baseOptions({ format: (value) => formatEurCompact(f, value), theme });
  options.plugins.tooltip.callbacks.label = (ctx) =>
    ` ${t("tooltip", { amount: formatEur(f, ctx.parsed.y), count: months[ctx.dataIndex]?.count || 0 })}`;

  return (
    <div className="chart-box">
      <Bar key={theme.mode} data={data} options={options} role="img" aria-label={t("aria", { label: seriesLabel })} />
    </div>
  );
}
