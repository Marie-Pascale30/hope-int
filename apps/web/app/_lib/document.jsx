import { headers } from "next/headers";
import { THEME_INIT_SCRIPT } from "@/src/utils/themeScript";
import { fontVariables } from "./fonts";
import { pwaInitScript } from "./pwa";

// Application installable : service worker enregistre en production uniquement.
const PWA_SCRIPT = pwaInitScript({ registerWorker: process.env.NODE_ENV === "production" });

// Squelette HTML commun aux deux layouts racines (site public et back-office).
// data-theme est pose par le script ci-dessous avant l'hydratation.
// Le nonce CSP de la requete (genere par proxy.js) autorise ces scripts inline. Lire headers()
// rend les pages dynamiques : c'est indispensable, Next n'applique le nonce a ses propres
// scripts que lors d'un rendu a la requete (une page statique serait bloquee par la CSP).
export default async function RootDocument({ locale, children }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Mode eco donnees et enregistrement du service worker (app/_lib/pwa.js). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PWA_SCRIPT }} />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}

export const rootViewport = {
  // viewport-fit=cover : env(safe-area-inset-*) disponible (barre de don collante, encoches).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f5f4a" },
    { media: "(prefers-color-scheme: dark)", color: "#101915" },
  ],
};
