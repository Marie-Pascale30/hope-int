import { setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import ProjectsView from "@/src/views/site/ProjectsView";
import { staticPageMetadata } from "@/src/views/site/seo";

export const revalidate = 60;

export function generateMetadata({ params }) {
  return staticPageMetadata(params, "projects", "/projets");
}

export default async function ProjectsPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data, error } = await settle(serverApi.listContent("projects", locale));
  return <ProjectsView projects={data} error={Boolean(error)} />;
}
