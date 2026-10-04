"use client";

// Graphiques de la vue d'ensemble (charge via next/dynamic, ssr: false).
import { useTranslations } from "next-intl";
import { Bar, Line, baseOptions, barDataset, lineDataset, useChartTheme } from "../../../components/AdminCharts";
import { useFormat } from "../../../i18n/format";

export function DonationsChart({ labels, values }) {
  const t = useTranslations("admin.charts");
  const f = useFormat();
  const theme = useChartTheme();
  const format = (value) => f.money(value, "eur", { compact: value >= 10000 });
  return (
    <div className="chart-box" role="img" aria-label={t("donationsAria")}>
      <Bar
        key={theme.mode}
        data={{ labels, datasets: [barDataset(t("donationsDataset"), values, theme.series[0], theme)] }}
        options={baseOptions({ format, theme })}
      />
    </div>
  );
}

export function MembersChart({ labels, values }) {
  const t = useTranslations("admin.charts");
  const f = useFormat();
  const theme = useChartTheme();
  const options = baseOptions({ format: (value) => f.number(value), theme });
  options.scales.y.ticks.precision = 0;
  return (
    <div className="chart-box" role="img" aria-label={t("membersAria")}>
      <Line
        key={theme.mode}
        data={{ labels, datasets: [lineDataset(t("membersDataset"), values, theme.series[0], { theme })] }}
        options={options}
      />
    </div>
  );
}
