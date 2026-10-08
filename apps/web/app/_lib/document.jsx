import { THEME_INIT_SCRIPT } from "@/src/utils/themeScript";
import ServiceWorkerRegister from "@/src/components/pwa/ServiceWorkerRegister";
import { fontVariables } from "./fonts";

// Squelette HTML commun aux deux layouts racines (site public et back-office).
// data-theme est pose par le script ci-dessous avant l'hydratation.
export default function RootDocument({ locale, children }) {
  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
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
  appleWebApp: { capable: true, title: "Hope", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const rootViewport = {
  // viewport-fit=cover : env(safe-area-inset-*) disponible (barre de don collante, encoches).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f5f4a" },
    { media: "(prefers-color-scheme: dark)", color: "#101915" },
  ],
};
