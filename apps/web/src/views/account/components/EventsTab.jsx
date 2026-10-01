"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { publicApi } from "../../../services";
import { getErrorMessage } from "../../../services/api";
import { confirmAction, showError, toast } from "../../../utils/alerts";
import { formatDate, formatTime, resolveImage } from "../../../utils/format";

function EventCard({ event, upcoming, onUnregistered }) {
  const [leaving, setLeaving] = useState(false);
  const start = new Date(event.start_at);

  const leave = async () => {
    const ok = await confirmAction(
      "Vous désinscrire ?",
      `Votre place pour « ${event.title} » sera libérée pour une autre personne.`,
      "Me désinscrire",
      { danger: true }
    );
    if (!ok) return;
    setLeaving(true);
    try {
      await publicApi.unregisterEvent(event.id);
      toast("Désinscription enregistrée");
      onUnregistered(event.id);
    } catch (err) {
      showError("Désinscription impossible", getErrorMessage(err));
      setLeaving(false);
    }
  };

  return (
    <Card pad={false} className={`acc-event${upcoming ? "" : " acc-event--past"}`}>
      <div className="acc-event__media cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveImage(event.image_url) || "/images/placeholder.svg"} alt="" loading="lazy" />
        <span className="acc-event__date" aria-hidden="true">
          <strong>{start.getDate()}</strong>
          {new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(start)}
        </span>
      </div>
      <div className="acc-event__body">
        {!upcoming && <Badge>Passé</Badge>}
        <h3 className="acc-event__title">
          <Link href={`/evenements/${event.id}`}>{event.title}</Link>
        </h3>
        <ul className="acc-event__meta">
          <li><CalendarDays size={15} aria-hidden="true" /> {formatDate(event.start_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</li>
          <li>
            <Clock size={15} aria-hidden="true" /> {formatTime(event.start_at)}
            {event.end_at && ` – ${formatTime(event.end_at)}`}
          </li>
          {event.location && <li><MapPin size={15} aria-hidden="true" /> {event.location}</li>}
        </ul>
        {upcoming && (
          <div className="row">
            <Button href={`/evenements/${event.id}`} size="sm" variant="secondary">Détails</Button>
            <Button size="sm" variant="ghost" onClick={leave} loading={leaving}>Me désinscrire</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function EventsTab() {
  const { data, loading, error, reload, setData } = useAsync(() => publicApi.myEvents(), []);
  const [now] = useState(() => Date.now());

  if (loading && !data) return <LoadingState label="Chargement de vos événements…" />;
  if (error && !data) return <ErrorState message={getErrorMessage(error)} onRetry={reload} />;

  const events = data || [];
  const isUpcoming = (event) => new Date(event.end_at || event.start_at).getTime() >= now;
  const upcoming = events.filter(isUpcoming).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const past = events.filter((event) => !isUpcoming(event)).sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  const removeEvent = (id) => setData((prev) => (prev || []).filter((event) => event.id !== id));

  if (!events.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Aucune inscription pour le moment"
        description="Ateliers, journées de collecte, rencontres : rejoignez-nous sur le terrain lors de nos prochains événements."
        action={<Button href="/evenements">Voir l’agenda</Button>}
      />
    );
  }

  return (
    <div className="stack acc-tab">
      <section className="stack" aria-labelledby="acc-upcoming-title">
        <div className="row row--between">
          <h2 id="acc-upcoming-title" className="acc-section-title">À venir</h2>
          <Button href="/evenements" size="sm" variant="secondary" icon={CalendarDays}>Voir l’agenda</Button>
        </div>
        {upcoming.length ? (
          <div className="acc-events">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} upcoming onUnregistered={removeEvent} />
            ))}
          </div>
        ) : (
          <p className="muted">
            Aucun événement à venir. <Link href="/evenements">Découvrez l’agenda</Link> pour vous inscrire.
          </p>
        )}
      </section>
      {past.length > 0 && (
        <section className="stack" aria-labelledby="acc-past-title">
          <h2 id="acc-past-title" className="acc-section-title">Passés</h2>
          <div className="acc-events">
            {past.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
