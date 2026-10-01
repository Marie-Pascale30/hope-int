import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@/src/styles/globals.css";
import "@/src/styles/site.css";
import "@/src/styles/admin.css";
import { AuthProvider } from "@/src/context/AuthContext";
import { LanguageProvider } from "@/src/i18n";

export const metadata = {
  title: {
    default: "HOPE International — Investir dans les rêves des familles",
    template: "%s · HOPE International",
  },
  description:
    "HOPE International accompagne les familles camerounaises vers l'autonomie grâce à la microfinance solidaire, la formation et l'entraide. Faites un don, devenez bénévole.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#1f5f4a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
