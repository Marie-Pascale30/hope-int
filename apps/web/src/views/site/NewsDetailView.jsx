// Detail d'une actualite (composant serveur). Le projet lie est facultatif.
import "../../styles/public.css";
import { ArrowRight, CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "../../i18n/format";
import ShareButtons from "../../components/ShareButtons";
import { Link, useLocalePath } from "../../i18n/navigation";
import { BackLink, CoverImage } from "./components";
import { paragraphs } from "./components/helpers";

export default function NewsDetailView({ item, linked }) {
  const t = useTranslations("site.newsDetail");
  const f = useFormat();
  const lp = useLocalePath();

  return (
    <section className="section section--tight">
      <article className="container pub-article">
        <BackLink href="/actualites">{t("back")}</BackLink>
        <div className="pub-article__meta">
          <span><CalendarDays aria-hidden="true" /> <time dateTime={item.created_at}>{f.date(item.created_at)}</time></span>
          {linked && (
            <span>
              {t("projectLabel")} <Link href={`/projets/${linked.id}`}>{linked.title}</Link>
            </span>
          )}
        </div>
        <h1>{item.title}</h1>
        {item.summary && <p className="lead">{item.summary}</p>}
        <div className="pub-detail-actions no-print">
          <ShareButtons path={lp(`/actualites/${item.id}`)} title={item.title} text={item.title} />
        </div>
        <CoverImage src={item.image_url} alt={item.image_alt} priority sizes="article" />
        <div className="prose">
          {paragraphs(item.content).map((text, index) => <p key={index}>{text}</p>)}
        </div>

        {linked && (
          <Link href={`/projets/${linked.id}`} className="card card--hover pub-linked">
            <CoverImage src={linked.image_url} sizes="thumb" />
            <span className="pub-linked__body">
              <span className="eyebrow pub-linked__eyebrow">{t("linkedEyebrow")}</span>
              <strong>{linked.title}</strong>
              {linked.summary && <span className="muted">{linked.summary}</span>}
              <span className="pub-card__more">{t("linkedCta")} <ArrowRight aria-hidden="true" /></span>
            </span>
          </Link>
        )}
      </article>
    </section>
  );
}
