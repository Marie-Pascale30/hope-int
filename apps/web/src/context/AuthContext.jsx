"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, DEFAULT_LOCALE, localizePath } from "../i18n/config";
import { authApi } from "../services";
import { hasSessionHint, setSessionHint } from "../services/api";
import { confirmAction, toast } from "../utils/alerts";

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
    // Lecture de la session apres le montage : le rendu serveur reste en "loading".
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Deconnexion demandee par l'utilisateur, apres confirmation (fenetre "Se deconnecter ?").
  // allDevices : ferme aussi les sessions ouvertes sur les autres appareils (l'appelant a deja
  // demande sa propre confirmation, plus explicite).
  const logout = useCallback(async (options) => {
    // Appele directement en onClick : l'argument peut etre l'evenement du clic.
    const allDevices = options?.allDevices === true;
    if (!allDevices) {
      const ok = await confirmAction(t("title"), t("text"), t("confirm"), { cancelText: t("cancel") });
      if (!ok) return false;
    }
    // Le cookie httpOnly ne peut etre efface que par l'API ; la session locale est fermee quoi qu'il arrive.
    if (allDevices) {
      // Echec de la revocation globale : l'erreur remonte a l'appelant, la session reste ouverte.
      await authApi.logoutAll();
    } else {
      await authApi.logout().catch(() => {});
    }
    clear();
    router.push(localizePath(locale, "/"));
    toast(allDevices ? t("doneAll") : t("done"));
  }, [clear, router, locale, t]);

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
