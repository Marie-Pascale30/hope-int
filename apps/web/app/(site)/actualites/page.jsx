import NewsView from "@/src/views/site/NewsView";

export const metadata = {
  title: "Actualités",
  description: "Les dernières nouvelles des projets de HOPE International : lancements, retours du terrain et vie de l'association.",
};

export default function NewsPage() {
  return <NewsView />;
}
