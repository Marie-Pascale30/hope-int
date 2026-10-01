import EventDetailView from "@/src/views/site/EventDetailView";
import { detailMetadata } from "@/src/views/site/serverMeta";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return detailMetadata(`/events/${id}`, {
    title: "Événement",
    description: "Un événement de HOPE International : informations pratiques et inscription.",
  }, (event) => event.description?.slice(0, 160));
}

export default function EventDetailPage() {
  return <EventDetailView />;
}
