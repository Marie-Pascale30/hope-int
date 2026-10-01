// Les 12 derniers mois ("2025-10" ... "2026-09"), mois courant inclus.
export function lastMonths(count = 12, from = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(from.getFullYear(), from.getMonth() - (count - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

// Aligne une serie mensuelle de l'API sur les 12 derniers mois (0 pour les mois absents).
export function alignMonthly(rows = [], valueKey, months = lastMonths()) {
  const byMonth = new Map(rows.map((row) => [row.month, Number(row[valueKey]) || 0]));
  return months.map((month) => byMonth.get(month) || 0);
}
