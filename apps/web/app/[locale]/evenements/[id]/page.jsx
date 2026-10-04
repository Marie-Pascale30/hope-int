import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizePath } from "@/src/i18n/config";
import { serverApi } from "@/src/services/server";
import LoadError from "@/src/views/site/components/LoadError";
import { loadDetail, loadForMetadata } from "@/src/views/site/detail";
import EventDetailView from "@/src/views/site/EventDetailView";
import { SITE_NAME, SITE_URL, absoluteUrl, buildMetadata, jsonLdProps, shareImage, truncateText } from "@/src/views/site/seo";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  const event = await loadForMetadata(serverApi.getEvent(id, locale));
  return buildMetadata({
    locale,
    path: `/evenements/${id}`,
    title: event?.title || t("event.title"),
    description: truncateText(event?.description) || t("event.description"),
    image: event ? shareImage(event.image_url, event.title) : null,
  });
}

export default async function EventDetailPage({ params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { data: event, error } = await loadDetail(serverApi.getEvent(id, locale));
  if (error) return <div className="container section"><LoadError /></div>;

  const image = shareImage(event.image_url, event.title);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: truncateText(event.description, 300),
    startDate: event.start_at,
    ...(event.end_at ? { endDate: event.end_at } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: absoluteUrl(localizePath(locale, `/evenements/${event.id}`)),
    ...(image ? { image: [image.url] } : {}),
    location: {
      "@type": "Place",
      name: event.location || event.region || "Cameroun",
      address: {
        "@type": "PostalAddress",
        ...(event.location ? { streetAddress: event.location } : {}),
        ...(event.region ? { addressRegion: event.region } : {}),
        addressCountry: "CM",
      },
    },
    ...(event.capacity ? { maximumAttendeeCapacity: event.capacity } : {}),
    isAccessibleForFree: true,
    organizer: { "@type": "NGO", name: SITE_NAME, url: SITE_URL },
  };

  return (
    <>
      <script {...jsonLdProps(jsonLd)} />
      <EventDetailView event={event} />
    </>
  );
}
