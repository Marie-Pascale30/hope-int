// Page "L'equipe et les benevoles" (composant serveur) : portraits des comptes qui ont consenti
// a apparaitre publiquement, puis temoignages publies.
import "@/src/styles/public.css";
import "@/src/styles/transparency.css";
import { MapPin, Quote, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, Button, Card } from "@/src/components/ui";
import { EmptyIllustration } from "@/src/components/illustrations";
import PageBanner from "@/src/components/site/PageBanner";
import { useLocalePath } from "@/src/i18n/navigation";
import { CoverImage, PublicHero } from "@/src/views/site/components";
import LoadError from "@/src/views/site/components/LoadError";
import { groupTeam } from "./helpers";

function Portrait({ member }) {
  const t = useTranslations("transparency.team");
  return (
    <li className="team-card">
      {member.photoUrl ? (
        <CoverImage src={member.photoUrl} alt={t("photoAlt", { name: member.name })} className="team-card__photo" sizes="160px" />
      ) : (
        <span className="team-card__initials"><Avatar name={member.name} large /></span>
      )}
      <div className="team-card__body">
        <h3>{member.name}</h3>
        {member.title && <p className="team-card__title">{member.title}</p>}
        {member.region && <p className="team-card__region"><MapPin aria-hidden="true" /> {member.region}</p>}
        {member.bio && <p className="team-card__bio">{member.bio}</p>}
      </div>
    </li>
  );
}

function Group({ id, title, text, members }) {
  if (!members.length) return null;
  return (
    <section className="team-group" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {text && <p className="muted">{text}</p>}
      <ul className="team-grid">
        {members.map((member, index) => <Portrait key={`${member.name}-${index}`} member={member} />)}
      </ul>
    </section>
  );
}

export default function TeamView({ members, testimonials = [], error }) {
  const t = useTranslations("transparency.team");
  const lp = useLocalePath();
  const { team, volunteers } = groupTeam(members || []);
  const quotes = (testimonials || []).slice(0, 6);

  return (
    <>
      <PageBanner name="team" />
      <PublicHero eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <section className="section section--tight">
        <div className="container">
          {error ? (
            <LoadError />
          ) : !team.length && !volunteers.length ? (
            <div className="tp-empty">
              <EmptyIllustration />
              <h2>{t("emptyTitle")}</h2>
              <p>{t("emptyText")}</p>
            </div>
          ) : (
            <>
              <Group id="team-staff" title={t("teamTitle")} text={t("teamText")} members={team} />
              <Group id="team-volunteers" title={t("volunteersTitle")} text={t("volunteersText")} members={volunteers} />
            </>
          )}
        </div>
      </section>

      {quotes.length > 0 && (
        <section className="section section--alt" aria-labelledby="team-quotes-title">
          <div className="container">
            <div className="section-head section-head--center">
              <span className="eyebrow">{t("quotesEyebrow")}</span>
              <h2 id="team-quotes-title">{t("quotesTitle")}</h2>
            </div>
            <div className="grid grid--3">
              {quotes.map((quote) => (
                <Card key={quote.id} as="figure" className="home-quote">
                  <Quote className="home-quote__mark" aria-hidden="true" />
                  <blockquote>{t("quoted", { text: quote.content })}</blockquote>
                  <figcaption>
                    <Avatar name={quote.author} large />
                    <span>
                      <strong>{quote.author}</strong>
                      {quote.role_label && <span>{quote.role_label}</span>}
                    </span>
                  </figcaption>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section section--tight" aria-labelledby="team-join-title">
        <div className="container">
          <div className="home-cta">
            <div>
              <h2 id="team-join-title">{t("joinTitle")}</h2>
              <p>{t("joinText")}</p>
            </div>
            <div className="home-cta__actions">
              <Button href={lp("/rejoindre")} variant="accent" size="lg" icon={UserPlus}>{t("joinCta")}</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
