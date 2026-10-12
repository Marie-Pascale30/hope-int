// Detail d'un evenement (composant serveur) ; inscription dans l'ilot RegistrationPanel.
import "../../styles/public.css";
import { ArrowDown, Clock, ExternalLink, FolderOpen, MapPin, Map as MapIcon, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "../../i18n/format";
import { Badge } from "../../components/ui";
import ShareButtons from "../../components/ShareButtons";
import { Link, useLocalePath } from "../../i18n/navigation";
import { BackLink, CoverImage, EventDate } from "./components";
import AddToCalendar from "./components/AddToCalendar";
import RegistrationPanel from "./components/RegistrationPanel";
import StickyAction from "./components/StickyAction";
import { eventTimeRange, isPast, paragraphs, spotsStatus } from "./components/helpers";

// Lien de carte (OpenStreetMap) a partir du lieu saisi, precise par la region et le pays.
export const mapUrl = (event) =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent([event.location, event.region, "Cameroun"].filter(Boolean).join(", "))}`;

export default function EventDetailView({ event }) {
  const t = useTranslations("site.eventDetail");
  const tSpots = useTranslations("site.spots");
  const f = useFormat();
  const lp = useLocalePath();
  const path = lp(`/evenements/${event.id}`);
  const past = isPast(event);
  const spots = spotsStatus(event, tSpots);

  return (
    <>
      <div className="container pub-detail-head">
        <BackLink href="/evenements">{t("back")}</BackLink>
        <CoverImage src={event.image_url} alt={event.image_alt} variant="wide" priority sizes="wide" />
        <div className="pub-detail-title">
          <div className="pub-event-when">
            <EventDate value={event.start_at} />
            <div>
              <strong>{f.date(event.start_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
              <span className="muted">{eventTimeRange(event, f)}</span>
            </div>
          </div>
          <h1>{event.title}</h1>
          <div className="pub-detail-actions no-print">
            {!past && <AddToCalendar event={event} path={path} />}
            <ShareButtons path={path} title={event.title} text={t("shareText", { title: event.title })} />
          </div>
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
                    <dd>
                      {event.location}
                      <a className="pub-map-link" href={mapUrl(event)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink aria-hidden="true" /> {t("map")}
                        <span className="visually-hidden"> {t("mapNewWindow")}</span>
                      </a>
                    </dd>
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
          <aside id="inscription" className="pub-aside" aria-label={t("registrationLabel")} tabIndex={-1}>
            <RegistrationPanel initialEvent={event} />
          </aside>
        </div>
      </section>
      {!past && (
        <StickyAction targetId="inscription" label={t("stickyLabel")}>
          <div className="pub-sticky__info">
            <strong>{f.date(event.start_at, { weekday: "short", day: "numeric", month: "short" })} · {f.time(event.start_at)}</strong>
            <Badge tone={spots.tone}>{spots.label}</Badge>
          </div>
          <a className="btn btn--accent" href="#inscription">
            <ArrowDown aria-hidden="true" /> {t("stickyRegister")}
          </a>
        </StickyAction>
      )}
    </>
  );
}
