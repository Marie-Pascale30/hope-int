"use client";

// Pont entre le site et l'application mobile (Capacitor). Sans effet dans un navigateur.
// - <html> recoit is-native-app et is-native-{ios|android} (ajustements CSS) ;
// - l'ecran de demarrage se ferme des que la page est affichee ;
// - la barre d'etat suit le theme clair / sombre ;
// - Android : le bouton retour revient a la page precedente, sinon a l'accueil, puis quitte l'application ;
// - liens vers d'autres sites, et don sur iPhone (regle Apple), ouverts hors de l'application.
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DONATE_PATH, donationOpensExternally, isNativeApp, nativePlatform, openExternal } from "../../utils/native";
import { useResolvedTheme } from "../../utils/theme";

// Accueil, avec ou sans prefixe de langue.
const HOME_PATH = /^\/(?:fr|en|es)?\/?$/;

const STATUS_BAR = {
  light: { style: "LIGHT", color: "#fbf7f0" },
  dark: { style: "DARK", color: "#17110e" },
};

export default function NativeBridge() {
  const theme = useResolvedTheme();
  const pathname = usePathname();
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (!isNativeApp()) return undefined;
    const root = document.documentElement;
    root.classList.add("is-native-app", `is-native-${nativePlatform()}`);

    import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide()).catch(() => {});

    let removeBack = null;
    if (nativePlatform() === "android") {
      import("@capacitor/app").then(({ App }) =>
        App.addListener("backButton", ({ canGoBack }) => {
          // Menu mobile ou fenetre ouverte : Echap les ferme (gere par chaque composant).
          if (root.classList.contains("has-mobile-nav") || document.querySelector("[role=dialog][aria-modal=true]")) {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          } else if (canGoBack) {
            window.history.back();
          } else if (!HOME_PATH.test(window.location.pathname)) {
            // Page ouverte directement (lien, notification) : retour a l'accueil dans la langue courante.
            const locale = window.location.pathname.match(/^\/(en|es)(?:\/|$)/)?.[1];
            routerRef.current.replace(locale ? `/${locale}` : "/");
          } else {
            App.exitApp();
          }
        }).then((handle) => { removeBack = handle; }),
      ).catch(() => {});
    }

    // Phase de capture : passe avant les liens Next (<Link>) pour les rediriger hors de l'application.
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (!/^https?:$/.test(url.protocol)) return; // tel:, mailto: : gere par le systeme
      const external = url.origin !== window.location.origin;
      const donation = !external && DONATE_PATH.test(url.pathname) && donationOpensExternally();
      if (!external && !donation) return;
      event.preventDefault();
      event.stopPropagation();
      openExternal(url.href);
    };
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("click", onClick, true);
      removeBack?.remove();
      root.classList.remove("is-native-app", `is-native-${nativePlatform()}`);
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    const { style, color } = STATUS_BAR[theme] || STATUS_BAR.light;
    import("@capacitor/status-bar")
      .then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: Style[style === "DARK" ? "Dark" : "Light"] });
        if (nativePlatform() === "android") StatusBar.setBackgroundColor({ color });
      })
      .catch(() => {});
  }, [theme]);

  // Arrivee sur la page de don sans passer par un lien (redirection, retour) : meme regle iPhone.
  useEffect(() => {
    if (!pathname || !DONATE_PATH.test(pathname) || !donationOpensExternally()) return;
    openExternal(window.location.href);
    if (window.history.length > 1) window.history.back();
  }, [pathname]);

  return null;
}
