// Liste des projets (composant serveur) ; filtres par statut et region dans l'ilot ProjectsBrowser.
import "../../styles/public.css";
import { FolderSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { hl } from "../../components/motion/hl";
import { useLocalePath } from "../../i18n/navigation";
import PageBanner from "../../components/site/PageBanner";
import { Empty, LinkButton, PublicHero } from "./components";
import { PublicHero } from "./components";
import LoadError from "./components/LoadError";
import ProjectsBrowser from "./components/ProjectsBrowser";
import { Button, EmptyState } from "../../components/ui";

// Ordre d'affichage : en cours, puis a venir, puis termines.
const STATUS_ORDER = { en_cours: 0, planifie: 1, termine: 2 };

export default function ProjectsView({ projects, error }) {
  const t = useTranslations("site.projects");
  const lp = useLocalePath();
  const sorted = [...(projects || [])].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));

  return (
    <>
      <PageBanner name="projects" />
      <PublicHero eyebrow={t("eyebrow")} title={t.rich("title", { hl })} lead={t("lead")} />
      <section className="section section--tight">
        <div className="container">
          {error ? (
            <LoadError />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={FolderSearch}
              title={t("emptyTitle")}
              description={t("emptyText")}
              action={<Button href={lp("/don")} variant="accent">{t("donate")}</Button>}
            />
          ) : (
            <ProjectsBrowser projects={sorted} />
          )}
        </div>
      </section>
    </>
  );
}
