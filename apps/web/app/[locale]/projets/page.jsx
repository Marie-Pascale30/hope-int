import { setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import { transparencyServer } from "@/src/services/transparencyServer";
import ProjectsView from "@/src/views/site/ProjectsView";
import { REGIONS } from "@hope/shared/constants";
import { staticPageMetadata } from "@/src/views/site/seo";

export const revalidate = 60;

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "projects", "/projets");
}

export default async function ProjectsPage({ params, searchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // ?region=Littoral : filtre initial (lien depuis la carte des regions).
  const requested = (await searchParams)?.region;
  const region = REGIONS.includes(requested) ? requested : "";
  const [{ data, error }, regions] = await Promise.all([
    settle(serverApi.listContent("projects", locale)),
    settle(transparencyServer.regions(locale)),
  ]);
  return <ProjectsView projects={data} error={Boolean(error)} regions={regions.data?.regions} region={region} />;
}
