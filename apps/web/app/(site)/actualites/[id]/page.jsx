import NewsDetailView from "@/src/views/site/NewsDetailView";
import { detailMetadata } from "@/src/views/site/serverMeta";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return detailMetadata(`/content/news/${id}`, {
    title: "Actualité",
    description: "Une actualité de HOPE International.",
  }, (news) => news.summary);
}

export default function NewsDetailPage() {
  return <NewsDetailView />;
}
