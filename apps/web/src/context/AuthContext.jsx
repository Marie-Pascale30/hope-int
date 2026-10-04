"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, DEFAULT_LOCALE, localizePath } from "../i18n/config";
import { authApi } from "../services";
import { hasSessionHint, setSessionHint } from "../services/api";
import { toast, useAlerts } from "../utils/alerts";

const AuthContext = createContext(null);

const PASSWORD_PAGE = "/changer-mot-de-passe";

// Chemin sans prefixe de langue ("/en/espace" -> "/espace").
const PREFIX_RE = new RegExp(`^/(${LOCALES.filter((l) => l !== DEFAULT_LOCALE).join("|")})(?=/|$)`);
const stripLocale = (path = "") => path.replace(PREFIX_RE, "") || "/";

export function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("ui.logout");
  const { confirmAction } = useAlerts();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | anonymous | authenticated

  const clear = useCallback(() => {
    setSessionHint(false);
    setUser(null);
    setStatus("anonymous");
  }, []);

  // Le profil (roles, permissions) est toujours relu aupres de l'API au chargement.
  const refresh = useCallback(async () => {
    if (!hasSessionHint()) {
      clear();
      return null;
    }
    try {
      const me = await authApi.me();
      setUser(me);
      setStatus("authenticated");
      return me;
    } catch {
      clear();
      return null;
    }
  }, [clear]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onExpired = () => {
      clear();
      router.push(localizePath(locale, `/connexion?expired=1&next=${encodeURIComponent(window.location.pathname)}`));
    };
    const onPasswordRequired = () => router.push(localizePath(locale, PASSWORD_PAGE));
    window.addEventListener("hope:session-expired", onExpired);
    window.addEventListener("hope:password-change-required", onPasswordRequired);
    return () => {
      window.removeEventListener("hope:session-expired", onExpired);
      window.removeEventListener("hope:password-change-required", onPasswordRequired);
    };
  }, [clear, router, locale]);

  // Mot de passe provisoire : aucune autre page tant qu'il n'est pas change.
  useEffect(() => {
    if (user?.mustChangePassword && stripLocale(pathname) !== PASSWORD_PAGE) {
      router.replace(localizePath(locale, PASSWORD_PAGE));
    }
  }, [user, pathname, router, locale]);

  const login = useCallback(async (email, password) => {
    const result = await authApi.login({ email, password });
    setSessionHint(true);
    setUser(result.user);
    setStatus("authenticated");
    return result.user;
  }, []);

  // Apres un changement de mot de passe, l'API pose un nouveau cookie et renvoie le profil a jour.
  const updateSession = useCallback((nextUser) => {
    if (nextUser) {
      setUser(nextUser);
      setStatus("authenticated");
    }
  }, []);

  // Deconnexion demandee par l'utilisateur : confirmation avant de fermer la session.
  const logout = useCallback(async () => {
    const confirmed = await confirmAction(t("title"), t("text"), t("confirm"));
    if (!confirmed) return;
    // Le cookie httpOnly ne peut etre efface que par l'API ; la session locale est fermee quoi qu'il arrive.
    await authApi.logout().catch(() => {});
    clear();
    router.push(localizePath(locale, "/"));
    toast(t("done"));
  }, [clear, router, locale, t, confirmAction]);

  const value = useMemo(
    () => ({ user, status, isAuthenticated: status === "authenticated", login, logout, refresh, updateSession }),
    [user, status, login, logout, refresh, updateSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return context;
}
