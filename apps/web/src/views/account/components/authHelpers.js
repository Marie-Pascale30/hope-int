import { isStaff } from "../../../utils/rbac";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTH_PAGES = ["/connexion", "/inscription", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe"];

// Seuls les chemins internes sont acceptes (pas de "//domaine" ni d'URL absolue).
export function safeNext(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (AUTH_PAGES.some((page) => value === page || value.startsWith(`${page}?`))) return null;
  return value;
}

// Page d'arrivee apres connexion.
export function destinationFor(user, next) {
  if (user?.mustChangePassword) return "/changer-mot-de-passe";
  if (next) return next;
  return isStaff(user) ? "/admin" : "/espace";
}

// Regles identiques a celles du backend (utils/security.js).
export function passwordChecks(password = "") {
  return [
    { key: "length", label: "8 caractères minimum", ok: password.length >= 8 },
    { key: "letter", label: "Au moins une lettre", ok: /[A-Za-z]/.test(password) },
    { key: "digit", label: "Au moins un chiffre", ok: /\d/.test(password) },
  ];
}

export const isStrongPassword = (password) => passwordChecks(password).every((check) => check.ok);
