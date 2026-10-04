// Detail d'un evenement (composant serveur) ; inscription dans l'ilot RegistrationPanel.
import "../../styles/public.css";
import { Clock, FolderOpen, MapPin, Map as MapIcon, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "../../i18n/format";
import { Link } from "../../i18n/navigation";
import { BackLink, CoverImage, EventDate } from "./components";
import RegistrationPanel from "./components/RegistrationPanel";
import { eventTimeRange, paragraphs } from "./components/helpers";

export default function EventDetailView({ event }) {
  const t = useTranslations("site.eventDetail");
  const f = useFormat();

  return (
    <>
      <div className="container pub-detail-head">
        <BackLink href="/evenements">{t("back")}</BackLink>
        <CoverImage src={event.image_url} variant="wide" priority sizes="wide" />
        <div className="pub-detail-title">
          <div className="pub-event-when">
            <EventDate value={event.start_at} />
            <div>
              <strong>{f.date(event.start_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
              <span className="muted">{eventTimeRange(event, f)}</span>
            </div>
          </div>
          <h1>{event.title}</h1>
        </div>
      </div>

      <section className="section section--tight">
        <div className="container pub-detail-layout">
          <div>
            <div className="pub-block">
              <h2>{t("program")}</h2>
              <div className="prose pub-prose">
                {paragraphs(event.description).map((text, index) => <p key={index}>{text}</p>)}
              </div>
            </div>
            <div className="pub-block">
              <h2>{t("practical")}</h2>
              <dl className="pub-facts">
                <div>
                  <dt><Clock aria-hidden="true" /> {t("schedule")}</dt>
                  <dd>{eventTimeRange(event, f)}</dd>
                </div>
                {event.location && (
                  <div>
                    <dt><MapPin aria-hidden="true" /> {t("location")}</dt>
                    <dd>{event.location}</dd>
                  </div>
                )}
                {event.region && (
                  <div>
                    <dt><MapIcon aria-hidden="true" /> {t("region")}</dt>
                    <dd>{event.region}</dd>
                  </div>
                )}
                <div>
                  <dt><Users aria-hidden="true" /> {t("capacity")}</dt>
                  <dd>{event.capacity ? t("capacityValue", { count: event.capacity }) : t("unlimited")}</dd>
                </div>
                {event.project_id && event.project_title && (
                  <div>
                    <dt><FolderOpen aria-hidden="true" /> {t("project")}</dt>
                    <dd><Link href={`/projets/${event.project_id}`}>{event.project_title}</Link></dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
          <aside className="pub-aside" aria-label={t("registrationLabel")}>
            <RegistrationPanel initialEvent={event} />
          </aside>
        </div>
      </section>
    </>
  );
}
