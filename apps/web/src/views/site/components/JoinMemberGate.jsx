"use client";

// Page "Nous rejoindre" selon la session : un visiteur voit la candidature, une personne connectee
// (deja membre de l'association) voit un message d'accueil a la place.
// Pendant la verification de session, la candidature reste affichee (cas le plus frequent, et
// contenu present des le rendu serveur).
import { CalendarDays, HeartHandshake, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { hl } from "../../../components/motion/hl";
import { useAuth } from "../../../context/AuthContext";
import { useLocalePath } from "../../../i18n/navigation";
import { LinkButton } from "./ui";

// Bandeau "Vous faites deja partie de la famille HOPE" (rien pour un visiteur).
export function MemberWelcome() {
  const t = useTranslations("site.join.welcome");
  const lp = useLocalePath();
  const { status, user } = useAuth();
  if (status !== "authenticated") return null;
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <section className="section section--tight" aria-labelledby="join-welcome-title">
      <div className="container">
        <div className="join-welcome">
          <span className="join-welcome__icon"><HeartHandshake aria-hidden="true" /></span>
          <div className="join-welcome__body">
            <span className="eyebrow">{t("eyebrow")}</span>
            <h2 id="join-welcome-title">
              {firstName ? t.rich("title", { name: firstName, hl }) : t.rich("titleNoName", { hl })}
            </h2>
            <p>{t("text")}</p>
            <div className="join-welcome__actions">
              <LinkButton href={lp("/espace")} variant="accent" icon={UserRound}>{t("account")}</LinkButton>
              <LinkButton href={lp("/evenements")} variant="secondary" icon={CalendarDays}>{t("events")}</LinkButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Contenu reserve aux visiteurs non connectes (la candidature).
export function GuestOnly({ children }) {
  const { status } = useAuth();
  return status === "authenticated" ? null : children;
}
