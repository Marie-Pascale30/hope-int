import { THEME_INIT_SCRIPT } from "@/src/utils/themeScript";
import { fontVariables } from "./fonts";

// Squelette HTML commun aux deux layouts racines (site public et back-office).
// data-theme est pose par le script ci-dessous avant l'hydratation.
export default function RootDocument({ locale, children }) {
  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
