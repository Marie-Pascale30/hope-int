// Page "Nous rejoindre" (composant serveur) ; formulaire de candidature dans l'ilot JoinForm.
// Personne connectee : message d'accueil a la place de la candidature (JoinMemberGate).
import "../../styles/public.css";
import { BadgeCheck, HandHeart, Sparkles, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { hl } from "../../components/motion/hl";
import { Card } from "../../components/ui";
import PageBanner from "../../components/site/PageBanner";
import { PublicHero } from "./components";
import JoinForm from "./components/JoinForm";
import MembershipFees from "./components/MembershipFees";
import { GuestOnly, MemberWelcome } from "./components/JoinMemberGate";

const WAYS = [
  { icon: HandHeart, key: "volunteer" },
  { icon: UsersRound, key: "member", accent: true },
  { icon: Sparkles, key: "responsibility" },
];

export default function JoinView({ regions = [], interestAreas = [] }) {
  const t = useTranslations("site.join");

  return (
    <>
      <PageBanner name="join" />
      <PublicHero eyebrow={t("eyebrow")} title={t.rich("title", { hl })} lead={t("lead")} />

      <MemberWelcome />

      <section className="section section--tight" aria-labelledby="join-ways-title">
        <div className="container">
          <div className="section-head section-head--center">
            <span className="eyebrow">{t("ways.eyebrow")}</span>
            <h2 id="join-ways-title">{t.rich("ways.title", { hl })}</h2>
            <p>{t("ways.text")}</p>
          </div>
          {/* Les trois facons de s'engager s'empilent au defilement (Stacking Cards) */}
          <ol className="stack-cards join-ways">
            {WAYS.map(({ icon: Icon, key, accent }, index) => (
              <li key={key} className="stack-cards__step" style={{ "--step": index }}>
                <Card className={`pub-feature${accent ? " pub-feature--accent" : ""}`}>
                  <span className="pub-feature__icon"><Icon aria-hidden="true" /></span>
                  <h3>{t(`ways.${key}.title`)}</h3>
                  <p>{t(`ways.${key}.text`)}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Role des membres, prerequis, droit d'adhesion et cotisations (bareme commun avec "Qui sommes-nous") */}
      <MembershipFees />

      <GuestOnly>
        <section className="section section--alt" aria-labelledby="join-form-title">
          <div className="container pub-form-layout">
            <div>
              <span className="eyebrow">{t("steps.eyebrow")}</span>
              <h2 id="join-form-title">{t("steps.title")}</h2>
              <ol className="pub-steps">
                <li><strong>{t("steps.s1.title")}</strong><span>{t("steps.s1.text")}</span></li>
                <li><strong>{t("steps.s2.title")}</strong><span>{t("steps.s2.text")}</span></li>
                <li><strong>{t("steps.s3.title")}</strong><span>{t("steps.s3.text")}</span></li>
              </ol>
              <p className="muted" style={{ marginTop: 20 }}>
                <BadgeCheck size={18} aria-hidden="true" style={{ display: "inline", verticalAlign: "-3px", marginRight: 6, color: "var(--brand)" }} />
                {t("privacy")}
              </p>
            </div>

            <JoinForm regions={regions} interestAreas={interestAreas} />
          </div>
        </section>
      </GuestOnly>
    </>
  );
}
