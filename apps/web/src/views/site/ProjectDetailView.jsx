// Detail d'un projet (composant serveur) : charge par app/[locale]/projets/[id]/page.jsx.
import "../../styles/public.css";
import { CalendarCheck, CalendarDays, GraduationCap, HandCoins, Heart, MapPin, Users, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Card, StatusBadge } from "../../components/ui";
import { useFormat } from "../../i18n/format";
import { useLocalePath } from "../../i18n/navigation";
import { BackLink, CampaignProgress, CoverImage, LinkButton, NewsCard, Stat, useProjectStatus } from "./components";
import { euros, hasCampaign, paragraphs } from "./components/helpers";

function CampaignAside({ project }) {
  const t = useTranslations("site.projectDetail.aside");
  const lp = useLocalePath();
  if (project.status === "termine") {
    return (
      <Card>
        <h2 className="pub-aside__title">{t("doneTitle")}</h2>
        <Alert tone="success" title={t("doneThanks")}>{t("doneText")}</Alert>
        <p className="muted" style={{ margin: "14px 0 0" }}>{t("doneMore")}</p>
        <LinkButton href={lp("/projets")} block>{t("doneCta")}</LinkButton>
      </Card>
    );
  }
  if (!hasCampaign(project)) {
    return (
      <Card>
        <h2 className="pub-aside__title">{t("supportTitle")}</h2>
        <p className="muted">{t("noCampaign")}</p>
        <LinkButton href={lp("/don")} variant="accent" icon={Heart} block>{t("donate")}</LinkButton>
      </Card>
    );
  }
  return (
    <Card>
      <span className="eyebrow">{t("campaign")}</span>
      <CampaignProgress project={project} large />
      <LinkButton href={lp(`/don?projet=${project.id}`)} variant="accent" size="lg" icon={Heart} block>
        {t("donateProject")}
      </LinkButton>
      <p className="pub-aside__note">{t("note")}</p>
    </Card>
  );
}

export default function ProjectDetailView({ project, related = [] }) {
  const t = useTranslations("site.projectDetail");
  const f = useFormat();
  const statusOf = useProjectStatus();
  const planned = project.status === "planifie";
  const indicator = (value) => (planned && !Number(value) ? t("upcoming") : f.number(value));

  return (
    <>
      <div className="container pub-detail-head">
        <BackLink href="/projets">{t("back")}</BackLink>
        <CoverImage src={project.image_url} variant="wide" priority sizes="wide" />
        <div className="pub-detail-title">
          <div className="chip-list" style={{ marginBottom: 14 }}>
            <StatusBadge status={statusOf(project.status)} />
            {project.region && (
              <Badge plain><MapPin size={14} aria-hidden="true" /> {project.region}</Badge>
            )}
          </div>
          <h1>{project.title}</h1>
          {project.summary && <p className="lead">{project.summary}</p>}
        </div>
      </div>

      <section className="section section--tight">
        <div className="container pub-detail-layout">
          <div>
            <div className="pub-block">
              <h2>{t("about")}</h2>
              <div className="prose pub-prose">
                {paragraphs(project.description).map((text, index) => <p key={index}>{text}</p>)}
              </div>
            </div>

            <div className="pub-block">
              <h2>{t("impact")}</h2>
              <div className="pub-indicators">
                <Stat label={t("beneficiaries")} value={indicator(project.beneficiaries)} icon={Users} />
                <Stat label={t("trainees")} value={indicator(project.trainees)} icon={GraduationCap} tone="info" />
                <Stat label={t("credits")} value={indicator(project.credits_granted)} icon={HandCoins} tone="accent" />
              </div>
              <dl className="pub-facts">
                <div>
                  <dt><CalendarDays aria-hidden="true" /> {t("start")}</dt>
                  <dd>{project.start_date ? f.date(project.start_date) : t("toBeDefined")}</dd>
                </div>
                <div>
                  <dt><CalendarCheck aria-hidden="true" /> {t("end")}</dt>
                  <dd>{project.end_date ? f.date(project.end_date) : t("noEnd")}</dd>
                </div>
                {Number(project.budget) > 0 && (
                  <div>
                    <dt><Wallet aria-hidden="true" /> {t("budget")}</dt>
                    <dd>{euros(f, project.budget)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <aside className="pub-aside" aria-label={t("asideLabel")}>
            <CampaignAside project={project} />
          </aside>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section section--alt" aria-labelledby="project-news-title">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">{t("newsEyebrow")}</span>
              <h2 id="project-news-title">{t("newsTitle")}</h2>
            </div>
            <div className="grid grid--3">
              {related.map((item) => <NewsCard key={item.id} item={item} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
