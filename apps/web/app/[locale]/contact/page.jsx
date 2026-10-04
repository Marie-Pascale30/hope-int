import { setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import ContactView from "@/src/views/site/ContactView";
import { staticPageMetadata } from "@/src/views/site/seo";

export const revalidate = 60;

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "contact", "/contact");
}

export default async function ContactPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data: meta } = await settle(serverApi.meta(locale));
  return <ContactView organization={meta?.organization || {}} />;
}
