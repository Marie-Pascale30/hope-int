// Liste des actualites (composant serveur).
import "../../styles/public.css";
import { Newspaper } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocalePath } from "../../i18n/navigation";
import { Empty, LinkButton, NewsCard, PublicHero } from "./components";
import LoadError from "./components/LoadError";

const byDateDesc = (a, b) => new Date(b.created_at) - new Date(a.created_at);

export default function NewsView({ news, error }) {
  const t = useTranslations("site.news");
  const lp = useLocalePath();
  const [featured, ...others] = [...(news || [])].sort(byDateDesc);

  return (
    <>
      <PublicHero eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <section className="section section--tight">
        <div className="container">
          {error ? (
            <LoadError />
          ) : !featured ? (
            <Empty
              icon={Newspaper}
              title={t("emptyTitle")}
              description={t("emptyText")}
              action={<LinkButton href={lp("/projets")}>{t("emptyCta")}</LinkButton>}
            />
          ) : (
            <div className="stack" style={{ gap: "clamp(20px, 3vw, 32px)" }}>
              <NewsCard item={featured} featured />
              {others.length > 0 && (
                <div className={others.length === 2 ? "grid grid--2" : "grid grid--3"}>
                  {others.map((item) => <NewsCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
