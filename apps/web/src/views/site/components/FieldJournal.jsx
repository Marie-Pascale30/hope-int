// Journal de terrain d'un projet : frise chronologique des actualites liees (date, photo,
// extrait), de la plus recente a la plus ancienne. Composant serveur (sans etat).
import { ArrowRight, CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/src/i18n/format";
import { Link } from "@/src/i18n/navigation";
import { truncate } from "@/src/utils/format";
import CoverImage from "./CoverImage";

// Nombre d'entrees affichees d'emblee ; les suivantes sont repliees.
export const JOURNAL_VISIBLE = 6;

// Actualites liees au projet, triees de la plus recente a la plus ancienne.
export function journalEntries(news = [], projectId) {
  return news
    .filter((item) => String(item.project_id) === String(projectId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || Number(b.id) - Number(a.id));
}

function Entry({ item }) {
  const t = useTranslations("transparency.journal");
  const f = useFormat();
  return (
    <li className="journal__entry">
      <span className="journal__dot" aria-hidden="true" />
      <article className="journal__card">
        <p className="journal__date">
          <CalendarDays aria-hidden="true" />
          <time dateTime={item.created_at}>{f.date(item.created_at)}</time>
        </p>
        <div className="journal__body">
          {item.image_url && (
            <CoverImage src={item.image_url} alt={item.image_alt} className="journal__photo" sizes="thumb" />
          )}
          <div>
            <h3 className="journal__title">
              <Link href={`/actualites/${item.id}`}>{item.title}</Link>
            </h3>
            <p className="journal__excerpt">{item.summary || truncate(item.content, 220)}</p>
            <span className="journal__more" aria-hidden="true">{t("readMore")} <ArrowRight /></span>
          </div>
        </div>
      </article>
    </li>
  );
}

export default function FieldJournal({ entries }) {
  const t = useTranslations("transparency.journal");
  if (!entries?.length) return null;
  const visible = entries.slice(0, JOURNAL_VISIBLE);
  const rest = entries.slice(JOURNAL_VISIBLE);
  return (
    <section className="section section--alt" aria-labelledby="project-journal-title">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h2 id="project-journal-title">{t("title")}</h2>
          <p>{t("text", { count: entries.length })}</p>
        </div>
        <ol className="journal">
          {visible.map((item) => <Entry key={item.id} item={item} />)}
        </ol>
        {rest.length > 0 && (
          <details className="journal__older">
            <summary>{t("older", { count: rest.length })}</summary>
            <ol className="journal">
              {rest.map((item) => <Entry key={item.id} item={item} />)}
            </ol>
          </details>
        )}
      </div>
    </section>
  );
}
