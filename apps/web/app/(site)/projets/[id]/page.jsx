import ProjectDetailView from "@/src/views/site/ProjectDetailView";
import { detailMetadata } from "@/src/views/site/serverMeta";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return detailMetadata(`/content/projects/${id}`, {
    title: "Projet",
    description: "Découvrez ce projet de HOPE International et soutenez-le par un don.",
  }, (project) => project.summary);
}

export default function ProjectDetailPage() {
  return <ProjectDetailView />;
}
