import EventsView from "@/src/views/site/EventsView";

export const metadata = {
  title: "Agenda",
  description: "Ateliers, journées de collecte, visites de terrain : l'agenda des prochains événements de HOPE International.",
};

export default function EventsPage() {
  return <EventsView />;
}
