// Liste des actualites (composant serveur).
import "../../styles/public.css";
import { Newspaper } from "lucide-react";
import { useTranslations } from "next-intl";
import { hl } from "../../components/motion/hl";
import { useLocalePath } from "../../i18n/navigation";
import PageBanner from "../../components/site/PageBanner";
import { NewsCard, PublicHero } from "./components";
import LoadError from "./components/LoadError";
import { Button, EmptyState } from "../../components/ui";

const byDateDesc = (a, b) => new Date(b.created_at) - new Date(a.created_at);

export default function NewsView({ news, error }) {
  const t = useTranslations("site.news");
  const lp = useLocalePath();
  const [featured, ...others] = [...(news || [])].sort(byDateDesc);

  return (
    <>
      <PageBanner name="news" />
      <PublicHero eyebrow={t("eyebrow")} title={t.rich("title", { hl })} lead={t("lead")} />
      <section className="section section--tight">
        <div className="container">
          {error ? (
            <LoadError />
          ) : !featured ? (
            <EmptyState
              icon={Newspaper}
              title={t("emptyTitle")}
              description={t("emptyText")}
              action={<Button href={lp("/projets")}>{t("emptyCta")}</Button>}
            />
          ) : (
            <div className="stack pub-news-stack">
              <NewsCard item={featured} featured headingLevel={2} />
              {others.length > 0 && (
                <div className={others.length === 2 ? "grid grid--2" : "grid grid--3"}>
                  {others.map((item) => <NewsCard key={item.id} item={item} headingLevel={2} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
