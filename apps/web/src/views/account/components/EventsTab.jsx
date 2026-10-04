"use client";

import { useState } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";
import { useFormat } from "../../../i18n/format";
import { Link, useLocalePath } from "../../../i18n/navigation";
import { publicApi } from "../../../services";
import { useAlerts } from "../../../utils/alerts";
import { resolveImage } from "../../../utils/format";
import { useErrorMessage } from "../../../i18n/errors";

function EventCard({ event, upcoming, onUnregistered }) {
  const t = useTranslations("account.events");
  const f = useFormat();
  const lp = useLocalePath();
  const { confirmAction, showError, toast } = useAlerts();
  const errorText = useErrorMessage();
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    const ok = await confirmAction(t("leaveTitle"), t("leaveText", { title: event.title }), t("leaveConfirm"), { danger: true });
    if (!ok) return;
    setLeaving(true);
    try {
      await publicApi.unregisterEvent(event.id);
      toast(t("left"));
      onUnregistered(event.id);
    } catch (err) {
      showError(t("leaveError"), errorText(err));
      setLeaving(false);
    }
  };

  return (
    <Card pad={false} className={`acc-event${upcoming ? "" : " acc-event--past"}`}>
      <div className="acc-event__media cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveImage(event.image_url) || "/images/placeholder.svg"} alt="" loading="lazy" />
        <span className="acc-event__date" aria-hidden="true">
          <strong>{f.date(event.start_at, { day: "numeric" })}</strong>
          {f.date(event.start_at, { month: "short" })}
        </span>
      </div>
      <div className="acc-event__body">
        {!upcoming && <Badge>{t("pastBadge")}</Badge>}
        <h3 className="acc-event__title">
          <Link href={`/evenements/${event.id}`}>{event.title}</Link>
        </h3>
        <ul className="acc-event__meta">
          <li><CalendarDays size={15} aria-hidden="true" /> {f.date(event.start_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</li>
          <li>
            <Clock size={15} aria-hidden="true" />{" "}
            {event.end_at ? t("timeRange", { start: f.time(event.start_at), end: f.time(event.end_at) }) : f.time(event.start_at)}
          </li>
          {event.location && <li><MapPin size={15} aria-hidden="true" /> {event.location}</li>}
        </ul>
        {upcoming && (
          <div className="row">
            <Button href={lp(`/evenements/${event.id}`)} size="sm" variant="secondary">{t("details")}</Button>
            <Button size="sm" variant="ghost" onClick={leave} loading={leaving}>{t("leaveConfirm")}</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function EventsTab() {
  const t = useTranslations("account.events");
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const { data, loading, error, reload, setData } = useAsync(() => publicApi.myEvents(), []);
  const [now] = useState(() => Date.now());

  if (loading && !data) return <LoadingState label={t("loading")} />;
  if (error && !data) return <ErrorState message={errorText(error)} onRetry={reload} />;

  const events = data || [];
  const isUpcoming = (event) => new Date(event.end_at || event.start_at).getTime() >= now;
  const upcoming = events.filter(isUpcoming).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const past = events.filter((event) => !isUpcoming(event)).sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  const removeEvent = (id) => setData((prev) => (prev || []).filter((event) => event.id !== id));

  if (!events.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t("emptyTitle")}
        description={t("emptyText")}
        action={<Button href={lp("/evenements")}>{t("agenda")}</Button>}
      />
    );
  }

  return (
    <div className="stack acc-tab">
      <section className="stack" aria-labelledby="acc-upcoming-title">
        <div className="row row--between">
          <h2 id="acc-upcoming-title" className="acc-section-title">{t("upcoming")}</h2>
          <Button href={lp("/evenements")} size="sm" variant="secondary" icon={CalendarDays}>{t("agenda")}</Button>
        </div>
        {upcoming.length ? (
          <div className="acc-events">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} upcoming onUnregistered={removeEvent} />
            ))}
          </div>
        ) : (
          <p className="muted">
            {t.rich("noUpcoming", { link: (chunks) => <Link href="/evenements">{chunks}</Link> })}
          </p>
        )}
      </section>
      {past.length > 0 && (
        <section className="stack" aria-labelledby="acc-past-title">
          <h2 id="acc-past-title" className="acc-section-title">{t("past")}</h2>
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
