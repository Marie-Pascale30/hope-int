import { headers } from "next/headers";
import { THEME_INIT_SCRIPT } from "@/src/utils/themeScript";
import NativeBridge from "@/src/components/native/NativeBridge";
import ServiceWorkerRegister from "@/src/components/pwa/ServiceWorkerRegister";
import { fontVariables } from "./fonts";
import { pwaInitScript } from "./pwa";

// Mode eco donnees seulement : le service worker est enregistre par <ServiceWorkerRegister />
// (production uniquement ; en developpement il desinscrit les anciens workers).
const PWA_SCRIPT = pwaInitScript({ registerWorker: false });

// Squelette HTML commun aux deux layouts racines (site public et back-office).
// data-theme est pose par le script ci-dessous avant l'hydratation.
// Le nonce CSP de la requete (genere par proxy.js) autorise ces scripts inline. Lire headers()
// rend les pages dynamiques : c'est indispensable, Next n'applique le nonce a ses propres
// scripts que lors d'un rendu a la requete (une page statique serait bloquee par la CSP).
export default async function RootDocument({ locale, children }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // data-scroll-behavior : Next desactive le defilement doux (globals.css) pendant les changements de page.
    <html lang={locale} className={fontVariables} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Mode eco donnees (app/_lib/pwa.js) ; icones et manifest : appMetadata ci-dessous. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PWA_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
        <NativeBridge />
      </body>
    </html>
  );
}

// Application installable (PWA) : manifest, icones et reglages iOS communs aux deux espaces.
export const appMetadata = {
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "HOPE", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const rootViewport = {
  // viewport-fit=cover : env(safe-area-inset-*) disponible (barre de don collante, encoches).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#642b17" },
    { media: "(prefers-color-scheme: dark)", color: "#17110e" },
  ],
};
