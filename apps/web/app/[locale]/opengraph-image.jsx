import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { routing } from "@/src/i18n/routing";

// Image de partage par defaut (Open Graph / Twitter), aux couleurs de la marque, dans chaque langue.
// Couleurs fixes : l'image est generee hors du navigateur (pas de tokens CSS ni de theme).
export const alt = "HOPE International";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OpengraphImage({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.home" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #1f5f4a 0%, #14261f 100%)",
          color: "#faf7f2",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="20" fill="#faf7f2" />
            <path d="M20 31V19" stroke="#1f5f4a" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M20 21c0-5.5 3.8-9.2 9.5-9.5-.3 5.7-4 9.5-9.5 9.5Z" fill="#d2772a" />
            <path d="M20 24c0-4.6-3.2-7.7-7.9-7.9.2 4.7 3.3 7.9 7.9 7.9Z" fill="#1f5f4a" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: 2 }}>HOPE</span>
            <span style={{ fontSize: 28, opacity: 0.85 }}>International</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>{t("title")}</span>
          <span style={{ fontSize: 30, opacity: 0.85, maxWidth: 980 }}>{t("eyebrow")}</span>
        </div>
        <div style={{ display: "flex", height: 10, width: 220, borderRadius: 5, background: "#d2772a" }} />
      </div>
    ),
    size
  );
}
