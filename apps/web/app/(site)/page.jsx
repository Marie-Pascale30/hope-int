import HomeView from "@/src/views/site/HomeView";

export const metadata = {
  title: { absolute: "HOPE International — Investir dans les rêves des familles" },
  description:
    "Microfinance solidaire, formation et entraide : HOPE International accompagne les femmes, les jeunes et les communautés rurales du Cameroun vers l'autonomie.",
};

export default function HomePage() {
  return <HomeView />;
}
