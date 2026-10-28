// Detail d'un projet (composant serveur) : charge par app/[locale]/projets/[id]/page.jsx.
import "../../styles/public.css";
import { CalendarCheck, CalendarDays, GraduationCap, HandCoins, Heart, MapPin, Users, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, Card, StatCard, StatusBadge } from "../../components/ui";
import NumberTicker from "../../components/motion/NumberTicker";
import { useFormat } from "../../i18n/format";
import { useLocalePath } from "../../i18n/navigation";
import ShareButtons from "../../components/ShareButtons";
import PhotoGallery from "../../components/site/PhotoGallery";
import { BackLink, CampaignProgress, CoverImage, useProjectStatus } from "./components";
import FieldJournal from "./components/FieldJournal";
import StickyAction from "./components/StickyAction";
import { campaignPercent, euros, hasCampaign, paragraphs } from "./components/helpers";
import { contentGallery } from "./gallery";
import { projectFallbackPhoto } from "./projectCover";

function CampaignAside({ project }) {
  const t = useTranslations("site.projectDetail.aside");
  const lp = useLocalePath();
  if (project.status === "termine") {
    return (
      <Card>
        <h2 className="pub-aside__title">{t("doneTitle")}</h2>
        <Alert tone="success" title={t("doneThanks")}>{t("doneText")}</Alert>
        <p className="muted" style={{ margin: "14px 0 0" }}>{t("doneMore")}</p>
        <Button href={lp("/projets")} block>{t("doneCta")}</Button>
      </Card>
    );
  }
  if (!hasCampaign(project)) {
    return (
      <Card>
        <h2 className="pub-aside__title">{t("supportTitle")}</h2>
        <p className="muted">{t("noCampaign")}</p>
        <Button href={lp("/don")} variant="accent" icon={Heart} block>{t("donate")}</Button>
      </Card>
    );
  }
  return (
    <Card>
      <span className="eyebrow">{t("campaign")}</span>
      <CampaignProgress project={project} large />
      <Button href={lp(`/don?projet=${project.id}`)} variant="accent" size="lg" icon={Heart} block>
        {t("donateProject")}
      </Button>
      <p className="pub-aside__note">{t("note")}</p>
    </Card>
  );
}

export default function ProjectDetailView({ project, related = [] }) {
  const t = useTranslations("site.projectDetail");
  const f = useFormat();
  const statusOf = useProjectStatus();
  const planned = project.status === "planifie";
  const indicator = (value) => (planned && !Number(value) ? t("upcoming") : <NumberTicker value={value} />);
  const lp = useLocalePath();
  const campaign = hasCampaign(project);
  const percent = campaignPercent(project);
  const tGallery = useTranslations("site.gallery");
  // Photos du projet (champ gallery : tableau, chaine JSON ou null).
  const photos = contentGallery(tGallery, f, project.gallery, project.title);

  return (
    <>
      <div className="container pub-detail-head">
        <BackLink href="/projets">{t("back")}</BackLink>
        <CoverImage
          src={project.image_url}
          alt={project.image_alt}
          fallback={projectFallbackPhoto(project)}
          variant="wide"
          priority
          sizes="wide"
        />
        <div className="pub-detail-title">
          <div className="chip-list" style={{ marginBottom: 14 }}>
            <StatusBadge status={statusOf(project.status)} />
            {project.region && (
              <Badge plain><MapPin size={14} aria-hidden="true" /> {project.region}</Badge>
            )}
          </div>
          <h1>{project.title}</h1>
          {project.summary && <p className="lead">{project.summary}</p>}
          <div className="pub-detail-actions no-print">
            <ShareButtons
              path={lp(`/projets/${project.id}`)}
              title={project.title}
              text={t("shareText", { title: project.title })}
            />
          </div>
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
                <StatCard label={t("beneficiaries")} value={indicator(project.beneficiaries)} icon={Users} />
                <StatCard label={t("trainees")} value={indicator(project.trainees)} icon={GraduationCap} tone="info" />
                <StatCard label={t("credits")} value={indicator(project.credits_granted)} icon={HandCoins} tone="accent" />
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

            {photos.length > 0 && (
              <div className="pub-block">
                <h2>{tGallery("detail.title")}</h2>
                <PhotoGallery items={photos} label={tGallery("detail.label", { title: project.title })} />
              </div>
            )}
          </div>

          <aside id="soutenir" className="pub-aside" aria-label={t("asideLabel")}>
            <CampaignAside project={project} />
          </aside>
        </div>
      </section>

      {project.status !== "termine" && (
        <StickyAction targetId="soutenir" label={t("stickyLabel")}>
          {campaign ? (
            <div className="pub-sticky__info">
              <span className="pub-sticky__label">{t("stickyProgress", { percent })}</span>
              <span className="pub-sticky__bar" aria-hidden="true"><span style={{ width: `${Math.min(100, percent)}%` }} /></span>
            </div>
          ) : (
            <div className="pub-sticky__info"><strong>{project.title}</strong></div>
          )}
          <Button href={lp(campaign ? `/don?projet=${project.id}` : "/don")} variant="accent" icon={Heart}>
            {t("stickySupport")}
          </Button>
        </StickyAction>
      )}

      {/* Journal de terrain : frise chronologique des actualites liees au projet. */}
      <FieldJournal entries={related} />
    </>
  );
}
