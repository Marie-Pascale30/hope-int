// Agenda (composant serveur) : calendrier et filtres dans l'ilot EventsAgenda.
import "../../styles/public.css";
import { CalendarX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocalePath } from "../../i18n/navigation";
import { PublicHero } from "./components";
import EventsAgenda from "./components/EventsAgenda";
import LoadError from "./components/LoadError";
import { Button, EmptyState } from "../../components/ui";

export default function EventsView({ events, error }) {
  const t = useTranslations("site.events");
  const lp = useLocalePath();
  const sorted = [...(events || [])].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

  return (
    <>
      <PublicHero eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <section className="section section--tight">
        <div className="container">
          {error ? (
            <LoadError />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title={t("emptyTitle")}
              description={t("emptyText")}
              action={<Button href={lp("/rejoindre")}>{t("emptyCta")}</Button>}
            />
          ) : (
            <EventsAgenda events={sorted} />
          )}
        </div>
      </section>
    </>
  );
}
