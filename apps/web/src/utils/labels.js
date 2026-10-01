// Libelles et tonalites (couleur de badge) des statuts metier.
// Tonalites disponibles : success | warning | danger | info | brand | accent | (vide = neutre)

export const ROLE_LABELS = {
  admin: "Administrateur système",
  directrice_generale: "Directrice générale",
  conseiller: "Conseiller stratégique",
  responsable_rh: "Responsable RH",
  responsable_finance: "Responsable financier",
  organisatrice: "Organisatrice",
  responsable_it: "Responsable IT",
  directrice_regionale: "Directrice régionale",
  secretaire_generale: "Secrétaire générale",
  membre: "Membre",
};

export const PROJECT_STATUS = {
  planifie: { label: "Bientôt", tone: "info" },
  en_cours: { label: "En cours", tone: "success" },
  termine: { label: "Terminé", tone: "" },
};

export const MESSAGE_STATUS = {
  nouveau: { label: "Nouveau", tone: "accent" },
  lu: { label: "Lu", tone: "info" },
  traite: { label: "Traité", tone: "success" },
  archive: { label: "Archivé", tone: "" },
};

export const APPLICATION_STATUS = {
  nouvelle: { label: "Nouvelle", tone: "accent" },
  en_etude: { label: "En étude", tone: "info" },
  acceptee: { label: "Acceptée", tone: "success" },
  refusee: { label: "Refusée", tone: "danger" },
};

export const PAYMENT_STATUS = {
  pending: { label: "En attente", tone: "warning" },
  succeeded: { label: "Réussi", tone: "success" },
  failed: { label: "Échoué", tone: "danger" },
  canceled: { label: "Annulé", tone: "" },
  refunded: { label: "Remboursé", tone: "info" },
};

export const USER_STATUS = {
  active: { label: "Actif", tone: "success" },
  inactive: { label: "Désactivé", tone: "danger" },
};

export const SUBSCRIPTION_STATUS = {
  active: { label: "Actif", tone: "success" },
  trialing: { label: "Actif", tone: "success" },
  past_due: { label: "Paiement en retard", tone: "warning" },
  incomplete: { label: "En attente", tone: "warning" },
  canceled: { label: "Arrêté", tone: "" },
  unpaid: { label: "Impayé", tone: "danger" },
  unknown: { label: "Statut indisponible", tone: "" },
};

export const PAYMENT_METHOD = {
  card: "Carte bancaire",
  mobile_money: "Mobile Money",
};

export const FREQUENCY = {
  once: "Ponctuel",
  monthly: "Mensuel",
};

export function statusOf(map, key) {
  return map[key] || { label: key || "—", tone: "" };
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "Membre";
}
