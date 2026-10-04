import axios from "axios";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");
// Origine du backend (sert les images uploadees : /uploads/...).
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

// Le jeton de session est un cookie httpOnly pose par l'API : le site n'y a jamais acces.
// On garde seulement un indicateur "session ouverte" (sans valeur secrete) pour eviter d'interroger
// /auth/me pour chaque visiteur anonyme et pour detecter une session expiree.
const SESSION_HINT_KEY = "hope_session";
const LEGACY_TOKEN_KEY = "hope_token";

export function hasSessionHint() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSessionHint(active) {
  if (typeof window === "undefined") return;
  try {
    // Ancien stockage du JWT (avant le passage au cookie) : supprime s'il existe encore.
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    if (active) localStorage.setItem(SESSION_HINT_KEY, "1");
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Stockage indisponible (navigation privee stricte) : la session reste valide via le cookie.
  }
}

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  // Envoie le cookie de session ; l'en-tete X-Requested-With est exige par la protection CSRF de l'API.
  withCredentials: true,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

// Langue courante transmise a l'API (messages d'erreur traduits) : celle de <html lang>,
// rendue par le serveur pour le site public comme pour le back-office.
const SUPPORTED_LANGUAGES = ["fr", "en", "es"];

API.interceptors.request.use((config) => {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang?.slice(0, 2);
    if (SUPPORTED_LANGUAGES.includes(lang)) config.headers.set("Accept-Language", lang);
  }
  return config;
});

// Evenements globaux ecoutes par AuthProvider (session expiree, mot de passe a changer).
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      const status = error.response?.status;
      const code = error.response?.data?.code;
      const url = error.config?.url || "";
      if (status === 401 && !url.startsWith("/auth/login") && hasSessionHint()) {
        window.dispatchEvent(new CustomEvent("hope:session-expired"));
      }
      if (status === 403 && code === "PASSWORD_CHANGE_REQUIRED") {
        window.dispatchEvent(new CustomEvent("hope:password-change-required"));
      }
    }
    return Promise.reject(error);
  }
);

export default API;
