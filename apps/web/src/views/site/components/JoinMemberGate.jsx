"use client";

// Page "Nous rejoindre" selon la session : un visiteur ou un invite (compte cree depuis le site,
// pas encore membre) voit la candidature ; un membre connecte voit un message d'accueil a la place.
// Pendant la verification de session, la candidature reste affichee (cas le plus frequent, et
// contenu present des le rendu serveur).
import { isGuestOnly } from "@hope/shared/volunteering";
import { CalendarDays, HeartHandshake, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { hl } from "../../../components/motion/hl";
import { useAuth } from "../../../context/AuthContext";
import { useLocalePath } from "../../../i18n/navigation";
import { Button } from "../../../components/ui";

// Membre connecte (au moins un role autre qu'invite).
function useIsMember() {
  const { status, user } = useAuth();
  return status === "authenticated" && !isGuestOnly(user?.roles || []);
}

// Bandeau "Vous faites deja partie de la famille HOPE" (rien pour un visiteur ou un invite).
export function MemberWelcome() {
  const t = useTranslations("site.join.welcome");
  const lp = useLocalePath();
  const { user } = useAuth();
  if (!useIsMember()) return null;
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
              <Button href={lp("/espace")} variant="accent" icon={UserRound}>{t("account")}</Button>
              <Button href={lp("/evenements")} variant="secondary" icon={CalendarDays}>{t("events")}</Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Contenu reserve aux non-membres : visiteurs et invites (la candidature).
export function GuestOnly({ children }) {
  return useIsMember() ? null : children;
}
