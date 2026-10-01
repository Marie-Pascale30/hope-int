"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "../services";
import { getToken, setToken } from "../services/api";
import { confirmAction, toast } from "../utils/alerts";

const AuthContext = createContext(null);

const PASSWORD_PAGE = "/changer-mot-de-passe";

export function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | anonymous | authenticated

  const clear = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  // Le profil (roles, permissions) est toujours relu aupres de l'API au chargement.
  const refresh = useCallback(async () => {
    if (!getToken()) {
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
      router.push(`/connexion?expired=1&next=${encodeURIComponent(window.location.pathname)}`);
    };
    const onPasswordRequired = () => router.push(PASSWORD_PAGE);
    window.addEventListener("hope:session-expired", onExpired);
    window.addEventListener("hope:password-change-required", onPasswordRequired);
    return () => {
      window.removeEventListener("hope:session-expired", onExpired);
      window.removeEventListener("hope:password-change-required", onPasswordRequired);
    };
  }, [clear, router]);

  // Mot de passe provisoire : aucune autre page tant qu'il n'est pas change.
  useEffect(() => {
    if (user?.mustChangePassword && pathname !== PASSWORD_PAGE) {
      router.replace(PASSWORD_PAGE);
    }
  }, [user, pathname, router]);

  const login = useCallback(async (email, password) => {
    const result = await authApi.login({ email, password });
    setToken(result.token);
    setUser(result.user);
    setStatus("authenticated");
    return result.user;
  }, []);

  // Apres un changement de mot de passe, le backend renvoie un nouveau jeton.
  const updateSession = useCallback((token, nextUser) => {
    if (token) setToken(token);
    if (nextUser) {
      setUser(nextUser);
      setStatus("authenticated");
    }
  }, []);

  // Deconnexion demandee par l'utilisateur : confirmation avant de fermer la session.
  const logout = useCallback(async () => {
    const confirmed = await confirmAction(
      "Se déconnecter ?",
      "Vous allez être déconnecté(e) de votre compte HOPE International. Vous pourrez vous reconnecter à tout moment.",
      "Se déconnecter"
    );
    if (!confirmed) return;
    clear();
    router.push("/");
    toast("Vous êtes déconnecté(e). À bientôt !");
  }, [clear, router]);

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
