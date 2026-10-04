import { getTranslations, setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import HomeView from "@/src/views/site/HomeView";
import { SITE_NAME, SITE_URL, buildMetadata, jsonLdProps } from "@/src/views/site/seo";

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return buildMetadata({ locale, path: "/", absoluteTitle: t("home.absoluteTitle"), description: t("home.description") });
}

export default async function HomePage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "site.meta" });

  // Cinq sources independantes : une erreur n'empeche pas d'afficher les autres.
  const [meta, impact, projects, testimonials, news, events] = await Promise.all([
    settle(serverApi.meta(locale)),
    settle(serverApi.impact(locale)),
    settle(serverApi.listContent("projects", locale)),
    settle(serverApi.listContent("testimonials", locale)),
    settle(serverApi.listContent("news", locale)),
    settle(serverApi.listEvents(locale)),
  ]);
  const failed = [impact, projects, testimonials, news, events].some((source) => source.error);
  const org = meta.data?.organization || {};

  const organization = {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: org.name || SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description: t("home.description"),
    areaServed: { "@type": "Country", name: "Cameroon" },
    ...(org.email ? { email: org.email } : {}),
    ...(org.phone ? { telephone: org.phone } : {}),
    ...(org.address ? { address: { "@type": "PostalAddress", streetAddress: org.address, addressCountry: "CM" } } : {}),
  };

  return (
    <>
      <script {...jsonLdProps(organization)} />
      <HomeView
        impact={impact.data}
        projects={projects.data}
        testimonials={testimonials.data}
        news={news.data}
        events={events.data}
        failed={failed}
      />
    </>
  );
}
