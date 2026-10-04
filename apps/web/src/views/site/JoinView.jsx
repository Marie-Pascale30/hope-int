// Page "Nous rejoindre" (composant serveur) ; formulaire de candidature dans l'ilot JoinForm.
import "../../styles/public.css";
import { BadgeCheck, HandHeart, Sparkles, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "../../components/ui";
import { PublicHero } from "./components";
import JoinForm from "./components/JoinForm";

const WAYS = [
  { icon: HandHeart, key: "volunteer" },
  { icon: UsersRound, key: "member", accent: true },
  { icon: Sparkles, key: "responsibility" },
];

export default function JoinView({ regions = [], interestAreas = [] }) {
  const t = useTranslations("site.join");

  return (
    <>
      <PublicHero eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <section className="section section--tight">
        <div className="container">
          <div className="grid grid--3">
            {WAYS.map(({ icon: Icon, key, accent }) => (
              <Card key={key} className={`pub-feature${accent ? " pub-feature--accent" : ""}`}>
                <span className="pub-feature__icon"><Icon aria-hidden="true" /></span>
                <h3>{t(`ways.${key}.title`)}</h3>
                <p>{t(`ways.${key}.text`)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

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
    </>
  );
}
