import { getTranslations, setRequestLocale } from "next-intl/server";
import { serverApi, settle } from "@/src/services/server";
import LoadError from "@/src/views/site/components/LoadError";
import { loadDetail, loadForMetadata } from "@/src/views/site/detail";
import ProjectDetailView from "@/src/views/site/ProjectDetailView";
import { buildMetadata, shareImage, truncateText } from "@/src/views/site/seo";

export const revalidate = 60;

// Pages de detail generees a la demande puis mises en cache (ISR).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  const project = await loadForMetadata(serverApi.getContent("projects", id, locale));
  return buildMetadata({
    locale,
    path: `/projets/${id}`,
    title: project?.title || t("project.title"),
    description: truncateText(project?.summary || project?.description) || t("project.description"),
    image: project ? shareImage(project.image_url, project.title) : null,
  });
}

export default async function ProjectDetailPage({ params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { data: project, error } = await loadDetail(serverApi.getContent("projects", id, locale));
  if (error) return <div className="container section"><LoadError /></div>;

  // Actualites liees : facultatives, ignorees si l'API ne repond pas.
  const { data: news } = await settle(serverApi.listContent("news", locale));
  const related = (news || []).filter((item) => String(item.project_id) === String(project.id)).slice(0, 3);
  return <ProjectDetailView project={project} related={related} />;
}
