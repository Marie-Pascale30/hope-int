import { setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import EventsView from "@/src/views/site/EventsView";
import { staticPageMetadata } from "@/src/views/site/seo";

export const revalidate = 60;

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "events", "/evenements");
}

export default async function EventsPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data, error } = await settle(serverApi.listEvents(locale));
  return <EventsView events={data} error={Boolean(error)} />;
}
