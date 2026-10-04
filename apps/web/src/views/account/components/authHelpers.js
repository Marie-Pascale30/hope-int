import { DEFAULT_LOCALE, LOCALES, localizePath } from "../../../i18n/config";
import { isStaff } from "../../../utils/rbac";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTH_PAGES = ["/connexion", "/inscription", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe"];

// Chemin sans prefixe de langue ("/en/connexion" -> "/connexion").
const PREFIX_RE = new RegExp(`^/(${LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).join("|")})(?=/|\\?|$)`);
export const stripLocale = (path = "") => {
  const stripped = path.replace(PREFIX_RE, "");
  return !stripped || stripped.startsWith("?") ? `/${stripped}` : stripped;
};

// Seuls les chemins internes sont acceptes (pas de "//domaine" ni d'URL absolue).
// Le chemin garde son prefixe de langue eventuel (il vient d'une page deja localisee).
export function safeNext(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const path = stripLocale(value);
  if (AUTH_PAGES.some((page) => path === page || path.startsWith(`${page}?`))) return null;
  return value;
}

// Page d'arrivee apres connexion (le back-office n'a pas de prefixe de langue).
export function destinationFor(user, next, locale = DEFAULT_LOCALE) {
  if (user?.mustChangePassword) return localizePath(locale, "/changer-mot-de-passe");
  if (next) return next;
  return isStaff(user) ? "/admin" : localizePath(locale, "/espace");
}

// Regles identiques a celles du backend (utils/security.js). Libelles : account.password.rules.<key>.
export function passwordChecks(password = "") {
  return [
    { key: "length", ok: password.length >= 8 },
    { key: "letter", ok: /[A-Za-z]/.test(password) },
    { key: "digit", ok: /\d/.test(password) },
  ];
}

export const isStrongPassword = (password) => passwordChecks(password).every((check) => check.ok);
