// Application mobile (coque Capacitor, apps/mobile) : detection et fonctions natives.
// Dans un navigateur, tout retombe sur les API web ; les plugins ne sont charges
// (import dynamique) que dans l'application.
import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

// "ios" | "android" | "web"
export function nativePlatform() {
  return isNativeApp() ? Capacitor.getPlatform() : "web";
}

// Page de don (/don, /en/don, /es/don), hors page de remerciement.
export const DONATE_PATH = /^\/(?:(?:fr|en|es)\/)?don\/?$/;

// iPhone / iPad : Apple n'autorise le don dans l'application qu'aux organismes a but non lucratif
// qu'il a approuves. Tant que ce n'est pas le cas, le don s'ouvre dans Safari (lien sortant).
// NEXT_PUBLIC_IOS_INAPP_DONATIONS=1 une fois l'approbation obtenue.
export function donationOpensExternally() {
  return nativePlatform() === "ios" && process.env.NEXT_PUBLIC_IOS_INAPP_DONATIONS !== "1";
}

// Ouvre une adresse hors de l'application : navigateur integre (Safari / Chrome Custom Tabs).
export async function openExternal(url) {
  if (!isNativeApp()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

// Partage : feuille de partage native dans l'application, Web Share API sinon,
// copie dans le presse-papiers en dernier recours. Renvoie "shared" | "copied".
export async function shareContent({ title, text, url }) {
  if (isNativeApp()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, text, url, dialogTitle: title });
    return "shared";
  }
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return "shared";
  }
  await navigator.clipboard.writeText(`${text} ${url}`);
  return "copied";
}
