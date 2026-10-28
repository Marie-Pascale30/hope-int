import { getTranslations, setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import { transparencyServer } from "@/src/services/transparencyServer";
import HomeView from "@/src/views/site/HomeView";
import { FACEBOOK_URL, withOrganizationDefaults } from "@/src/views/site/organization";
import { SITE_URL, buildMetadata, jsonLdProps } from "@/src/views/site/seo";

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
  const [meta, impact, projects, testimonials, news, events, regions] = await Promise.all([
    settle(serverApi.meta(locale)),
    settle(serverApi.impact(locale)),
    settle(serverApi.listContent("projects", locale)),
    settle(serverApi.listContent("testimonials", locale)),
    settle(serverApi.listContent("news", locale)),
    settle(serverApi.listEvents(locale)),
    // Carte des regions : facultative (masquee si l'API ne repond pas).
    settle(transparencyServer.regions(locale)),
  ]);
  const failed = [impact, projects, testimonials, news, events].some((source) => source.error);
  const org = withOrganizationDefaults(meta.data?.organization);
  const tAbout = await getTranslations({ locale, namespace: "site.about" });
  const facebook = process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || FACEBOOK_URL;

  const organization = {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: org.name,
    alternateName: "HOPE Intl Project",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description: t("home.description"),
    slogan: tAbout("motto.slogan"),
    areaServed: { "@type": "Country", name: "Cameroon" },
    email: org.email,
    telephone: org.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: org.address,
      postOfficeBoxNumber: org.poBox,
      addressLocality: "Douala",
      addressCountry: "CM",
    },
    sameAs: [facebook],
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
        regions={regions.data?.regions}
        xafPerEur={meta.data?.xafPerEur}
        failed={failed}
      />
    </>
  );
}
