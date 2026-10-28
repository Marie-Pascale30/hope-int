// Configuration Capacitor : l'application charge le site HOPE International Project en ligne
// (rendu serveur, donnees a jour, trois langues) dans une coque native. Les fonctions
// natives (barre d'etat, ecran de demarrage, retour Android, partage, liens externes)
// sont branchees cote site dans apps/web/src/components/native/NativeBridge.jsx.
//
// HOPE_APP_URL : adresse du site charge par l'application.
//   - production : https://hopeintapp.com (valeur par defaut ci-dessous)
//   - developpement Android : http://localhost:3001 avec "adb reverse" (voir scripts/android-dev.js)
const APP_URL = process.env.HOPE_APP_URL || "https://hopeintapp.com";
const isHttp = APP_URL.startsWith("http://");

/** @type {import('@capacitor/cli').CapacitorConfig} */
module.exports = {
  appId: "org.hopeinternational.app",
  appName: "HOPE International Project",
  // Page locale de secours, affichee si le site ne se charge pas (pas de reseau au lancement).
  webDir: "www",
  server: {
    url: APP_URL,
    errorPath: "offline.html",
    // HTTP en clair : uniquement pour le developpement local.
    cleartext: isHttp,
    // Navigation autorisee dans l'application ; les autres domaines s'ouvrent dans le navigateur.
    allowNavigation: [new URL(APP_URL).host],
  },
  android: {
    allowMixedContent: isHttp,
  },
  ios: {
    contentInset: "never",
    // Le site gere lui-meme ses marges (viewport-fit=cover et env(safe-area-inset-*)).
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      // Masque par le site une fois la premiere page affichee (NativeBridge), 6 s au plus.
      launchAutoHide: true,
      launchShowDuration: 6000,
      backgroundColor: "#fbf7f0",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      backgroundColor: "#fbf7f0",
      style: "LIGHT",
      overlaysWebView: false,
    },
  },
};
