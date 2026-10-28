import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { routing } from "@/src/i18n/routing";

// Image de partage par defaut (Open Graph / Twitter), aux couleurs de la marque, dans chaque langue.
// Couleurs fixes : l'image est generee hors du navigateur (pas de tokens CSS ni de theme).
export const alt = "HOPE International Project";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OpengraphImage({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.home" });
  // Embleme officiel (soleil detoure) integre en data URL : ImageResponse ne lit pas public/.
  const sun = await readFile(join(process.cwd(), "public/images/brand/soleil-hope-detoure.png"));
  const sunSrc = `data:image/png;base64,${sun.toString("base64")}`;

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
          background: "linear-gradient(135deg, #642b17 0%, #24140d 100%)",
          color: "#fbf7f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendu par next/og, pas par le navigateur */}
          <img src={sunSrc} width={118} height={120} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: 2 }}>HOPE</span>
            <span style={{ fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: "#f0ba2a" }}>International Project</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>{t("title")}</span>
          <span style={{ fontSize: 30, opacity: 0.85, maxWidth: 980 }}>{t("eyebrow")}</span>
        </div>
        <div style={{ display: "flex", height: 10, width: 220, borderRadius: 5, background: "#f0ba2a" }} />
      </div>
    ),
    size
  );
}
