import { headers } from "next/headers";
import { THEME_INIT_SCRIPT } from "@/src/utils/themeScript";
import { fontVariables } from "./fonts";

// Squelette HTML commun aux deux layouts racines (site public et back-office).
// data-theme est pose par le script ci-dessous avant l'hydratation.
// Le nonce CSP de la requete (genere par proxy.js) autorise ce script inline. Lire headers()
// rend les pages dynamiques : c'est indispensable, Next n'applique le nonce a ses propres
// scripts que lors d'un rendu a la requete (une page statique serait bloquee par la CSP).
export default async function RootDocument({ locale, children }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
