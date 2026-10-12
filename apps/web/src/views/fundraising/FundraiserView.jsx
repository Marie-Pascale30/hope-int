// Page publique d'une collecte personnelle (composant serveur) : histoire, jauge, derniers soutiens
// (anonymisables), bouton de don et partage WhatsApp. Chargee par app/[locale]/collecte/[slug].
import "../../styles/public.css";
import "../../styles/fundraising.css";
import { CalendarDays, Heart, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, Card, ProgressBar } from "../../components/ui";
import ShareButtons from "../../components/ShareButtons";
import { useFormat } from "../../i18n/format";
import { useLocalePath } from "../../i18n/navigation";
import { resolveImage } from "../../utils/format";
import { SOURCES } from "@hope/shared/fundraising";
import { donatePath } from "./donateParams";
import { fundraiserPercent } from "./helpers";

export default function FundraiserView({ fundraiser, source }) {
  const t = useTranslations("fundraising.page");
  const f = useFormat();
  const lp = useLocalePath();
  const percent = fundraiserPercent(fundraiser);
  const image = resolveImage(fundraiser.image_url);
  const donateHref = lp(donatePath({ fundraiser: fundraiser.slug, source: source || SOURCES.fundraiser }));
  const path = lp(`/collecte/${fundraiser.slug}`);

  return (
    <article className="container fr-page">
      <div className="fr-page__grid">
        <div>
          <span className="eyebrow">{t("eyebrow", { project: fundraiser.project_title || "" })}</span>
          <h1>{fundraiser.title}</h1>
          <p className="fr-page__meta">
            {fundraiser.organizer ? t("organizer", { name: fundraiser.organizer }) : null}
            {fundraiser.ends_on ? ` · ${t("endsOn", { date: f.date(fundraiser.ends_on) })}` : null}
          </p>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="fr-page__image" src={image} alt="" loading="lazy" style={{ marginTop: 24 }} />
          )}
          <h2 style={{ marginTop: 32 }}>{t("storyTitle")}</h2>
          <p className="fr-page__story">{fundraiser.story}</p>
          <p className="muted">{t("projectNote", { project: fundraiser.project_title || "" })}</p>
        </div>

        <aside className="fr-page__aside">
          <Card>
            <div className="fr-gauge">
              <p className="fr-gauge__raised">{f.money(fundraiser.raised, fundraiser.currency)}</p>
              <p className="fr-gauge__goal">
                {t("goal", { goal: f.money(fundraiser.goal_amount, fundraiser.currency), percent })}
              </p>
              <ProgressBar value={percent} accent label={t("progressLabel", { percent })} />
              <p className="fr-page__meta">
                <Users size={16} aria-hidden="true" /> {t("supporters", { count: fundraiser.supporters_count })}
                {fundraiser.ends_on && (
                  <>
                    {" · "}
                    <CalendarDays size={16} aria-hidden="true" /> {t("until", { date: f.date(fundraiser.ends_on) })}
                  </>
                )}
              </p>
            </div>
            {fundraiser.open ? (
              <Button href={donateHref} variant="accent" size="lg" icon={Heart} block>{t("donate")}</Button>
            ) : (
              <Alert tone="info" title={t("closedTitle")}>{t("closedText")}</Alert>
            )}
            <div style={{ marginTop: 16 }}>
              <ShareButtons
                path={path}
                title={fundraiser.title}
                text={t("shareText", { title: fundraiser.title })}
                label={t("shareLabel")}
                source={SOURCES.shareNative}
              />
            </div>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <h2 className="pub-aside__title">{t("recentTitle")}</h2>
            {fundraiser.supporters.length ? (
              <ul className="fr-supporters">
                {fundraiser.supporters.map((supporter) => (
                  <li key={supporter.id}>
                    <span>{supporter.name || <Badge plain>{t("anonymous")}</Badge>}</span>
                    <time dateTime={supporter.date}>{f.date(supporter.date)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("noSupporters")}</p>
            )}
          </Card>
        </aside>
      </div>
    </article>
  );
}
