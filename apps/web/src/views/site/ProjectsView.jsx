// Liste des projets (composant serveur) ; filtres par statut et region dans l'ilot ProjectsBrowser.
import "../../styles/public.css";
import { FolderSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocalePath } from "../../i18n/navigation";
import { Empty, LinkButton, PublicHero } from "./components";
import LoadError from "./components/LoadError";
import ProjectsBrowser from "./components/ProjectsBrowser";

// Ordre d'affichage : en cours, puis a venir, puis termines.
const STATUS_ORDER = { en_cours: 0, planifie: 1, termine: 2 };

export default function ProjectsView({ projects, error }) {
  const t = useTranslations("site.projects");
  const lp = useLocalePath();
  const sorted = [...(projects || [])].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));

  return (
    <>
      <PublicHero eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <section className="section section--tight">
        <div className="container">
          {error ? (
            <LoadError />
          ) : sorted.length === 0 ? (
            <Empty
              icon={FolderSearch}
              title={t("emptyTitle")}
              description={t("emptyText")}
              action={<LinkButton href={lp("/don")} variant="accent">{t("donate")}</LinkButton>}
            />
          ) : (
            <ProjectsBrowser projects={sorted} />
          )}
        </div>
      </section>
    </>
  );
}
