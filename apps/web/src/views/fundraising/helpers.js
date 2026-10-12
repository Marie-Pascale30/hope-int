// Fonctions pures des collectes personnelles (partagees serveur / client, testees).

// Pourcentage atteint de l'objectif (0-100, arrondi).
export function fundraiserPercent(fundraiser) {
  const goal = Number(fundraiser?.goal_amount) || 0;
  if (!goal) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(fundraiser.raised) / goal) * 100)));
}
