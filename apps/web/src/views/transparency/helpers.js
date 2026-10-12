// Fonctions pures de la transparence (testees : test/unit/transparencyHelpers.test.js).

// Lignes d'un tableau de repartition : { key, label, value, percent } triees par montant.
export function shareRows(rows = [], keyOf, labelOf) {
  const total = rows.reduce((sum, row) => sum + (Number(row.amountEur) || 0), 0);
  return [...rows]
    .filter((row) => Number(row.amountEur) > 0)
    .sort((a, b) => b.amountEur - a.amountEur)
    .map((row) => ({
      key: keyOf(row),
      label: labelOf(row),
      value: Number(row.amountEur),
      percent: total ? Math.round((Number(row.amountEur) / total) * 1000) / 10 : 0,
    }));
}

// Annee demandee dans l'URL : 4 chiffres, sinon null.
export function parseYear(value) {
  return /^\d{4}$/.test(String(value)) ? Number(value) : null;
}

// Ecart prevu / realise : classe de ton (depassement, sous-consommation, conforme).
export function varianceTone(plannedEur, spentEur) {
  if (!plannedEur) return spentEur > 0 ? "warning" : "neutral";
  const rate = spentEur / plannedEur;
  if (rate > 1.05) return "danger";
  if (rate < 0.5) return "info";
  return "success";
}

// Portraits regroupes : equipe puis benevoles.
export function groupTeam(members = []) {
  return {
    team: members.filter((member) => member.group === "team"),
    volunteers: members.filter((member) => member.group !== "team"),
  };
}
