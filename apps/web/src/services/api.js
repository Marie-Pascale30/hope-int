import axios from "axios";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");
// Origine du backend (sert les images uploadees : /uploads/...).
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

const TOKEN_KEY = "hope_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Stockage indisponible (navigation privee stricte) : session limitee a l'onglet.
  }
}

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

API.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
      if (status === 401 && !url.startsWith("/auth/login") && getToken()) {
        window.dispatchEvent(new CustomEvent("hope:session-expired"));
      }
      if (status === 403 && code === "PASSWORD_CHANGE_REQUIRED") {
        window.dispatchEvent(new CustomEvent("hope:password-change-required"));
      }
    }
    return Promise.reject(error);
  }
);

// Message d'erreur lisible a partir d'une erreur axios.
export function getErrorMessage(error, fallback = "Une erreur est survenue. Réessayez dans un instant.") {
  const data = error?.response?.data;
  if (data?.error) return data.error;
  if (Array.isArray(data?.errors) && data.errors.length) {
    const first = data.errors[0];
    const field = first.path ? `${first.path} : ` : "";
    return `Champ invalide — ${field}${first.msg === "Invalid value" ? "valeur incorrecte" : first.msg}`;
  }
  if (error?.code === "ECONNABORTED") return "Le serveur met trop de temps à répondre.";
  if (error?.message === "Network Error") return "Impossible de joindre le serveur. Vérifiez votre connexion.";
  return fallback;
}

export default API;
