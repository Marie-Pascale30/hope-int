// Mentions legales et politique de confidentialite : valeurs propres a la publication du site.
// Les informations encore inconnues (numero de declaration de l'association, hebergeur, direction
// de la publication si elle n'est pas assuree par la presidente) se renseignent par des variables
// d'environnement lues cote serveur (voir .env.example) : une ligne vide n'est pas affichee.
// Pages regenerees periodiquement (revalidate) : les variables doivent etre presentes au build
// et a l'execution du serveur Next.js.

// Date de derniere mise a jour des deux textes (a modifier a chaque revision du contenu).
export const LEGAL_UPDATED_AT = "2026-10-28";

// Durees de conservation affichees : memes noms et memes valeurs par defaut que l'API
// (apps/api/services/privacyRetentionService.js et privacyService.js). Si l'API est configuree
// avec d'autres durees, renseigner les memes variables pour le site.
const RETENTION_DEFAULTS = {
  RETENTION_OUTBOX_DAYS: 30,
  RETENTION_LOGS_MONTHS: 12,
  RETENTION_REFUSED_APPLICATIONS_MONTHS: 24,
  ACCOUNTING_RETENTION_YEARS: 10,
};

const text = (value) => (typeof value === "string" ? value.trim() : "");

const duration = (env, name) => {
  const value = Number(env[name]);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : RETENTION_DEFAULTS[name];
};

export function legalConfig(env = process.env) {
  return {
    registrationNumber: text(env.LEGAL_REGISTRATION_NUMBER),
    publicationDirector: text(env.LEGAL_PUBLICATION_DIRECTOR),
    host: {
      name: text(env.LEGAL_HOST_NAME),
      address: text(env.LEGAL_HOST_ADDRESS),
      contact: text(env.LEGAL_HOST_CONTACT),
    },
    retention: {
      outboxDays: duration(env, "RETENTION_OUTBOX_DAYS"),
      logsMonths: duration(env, "RETENTION_LOGS_MONTHS"),
      refusedMonths: duration(env, "RETENTION_REFUSED_APPLICATIONS_MONTHS"),
      accountingYears: duration(env, "ACCOUNTING_RETENTION_YEARS"),
    },
  };
}

// "https://hopeintapp.com/" -> "hopeintapp.com" (affichage du domaine du site).
export function siteHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return text(url);
  }
}
