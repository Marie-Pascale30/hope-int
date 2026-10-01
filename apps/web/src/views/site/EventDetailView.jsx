"use client";

import "../../styles/public.css";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarX, CheckCircle2, Clock, FolderOpen, LogIn, MapPin, Map as MapIcon, Users } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, LoadingState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { confirmAction, showError, toast } from "../../utils/alerts";
import { formatDate, formatNumber } from "../../utils/format";
import { BackLink, CoverImage, EventDate } from "./components";
import { eventTimeRange, isNotFound, isPast, paragraphs, plural, spotsStatus } from "./components/helpers";

function RegistrationPanel({ event, onChange }) {
  const { status } = useAuth();
  const [busy, setBusy] = useState(false);
  const spots = spotsStatus(event);
  const full = event.remaining_spots !== null && event.remaining_spots !== undefined && event.remaining_spots <= 0;
  const past = isPast(event);

  const register = async () => {
    setBusy(true);
    try {
      await publicApi.registerEvent(event.id);
      toast("Inscription confirmée, à bientôt !");
      await onChange();
    } catch (err) {
      showError("Inscription impossible", getErrorMessage(err));
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const unregister = async () => {
    const ok = await confirmAction(
      "Annuler votre inscription ?",
      "Votre place sera libérée pour une autre personne. Vous pourrez vous réinscrire s’il reste des places.",
      "Annuler mon inscription",
      { danger: true }
    );
    if (!ok) return;
    setBusy(true);
    try {
      await publicApi.unregisterEvent(event.id);
      toast("Inscription annulée");
      await onChange();
    } catch (err) {
      showError("Annulation impossible", getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  let action;
  if (past) {
    action = <Alert tone="info">Cet événement est terminé. Consultez l’agenda pour les prochains rendez-vous.</Alert>;
  } else if (status === "loading") {
    action = <Button block loading disabled>Vérification de votre session…</Button>;
  } else if (status !== "authenticated") {
    action = (
      <>
        <Button href={`/connexion?next=${encodeURIComponent(`/evenements/${event.id}`)}`} size="lg" icon={LogIn} block>
          Se connecter pour s’inscrire
        </Button>
        <p className="pub-aside__note">
          Pas encore de compte ? <Link href="/inscription">Créez-le en une minute</Link>.
        </p>
      </>
    );
  } else if (event.is_registered) {
    action = (
      <>
        <div className="pub-registered"><CheckCircle2 aria-hidden="true" /> Vous êtes inscrit(e) à cet événement.</div>
        <Button variant="secondary" block loading={busy} onClick={unregister}>Annuler mon inscription</Button>
      </>
    );
  } else if (full) {
    action = <Button size="lg" block disabled>Complet</Button>;
  } else {
    action = <Button size="lg" variant="accent" block loading={busy} onClick={register}>Je m’inscris</Button>;
  }

  return (
    <Card>
      <h2 className="pub-aside__title">Participer</h2>
      <div className="stack" style={{ gap: 10 }}>
        <div className="row row--between">
          <span className="muted">Places</span>
          <Badge tone={spots.tone}>{spots.label}</Badge>
        </div>
        <div className="row row--between">
          <span className="muted">Participants inscrits</span>
          <strong>{formatNumber(event.registered_count)}{event.capacity ? ` / ${formatNumber(event.capacity)}` : ""}</strong>
        </div>
        <hr className="divider" style={{ margin: "6px 0" }} />
        {action}
      </div>
    </Card>
  );
}

export default function EventDetailView() {
  const { id } = useParams();
  const { status } = useAuth();
  const { data: event, loading, error, reload, setData } = useAsync(() => publicApi.getEvent(id), [id, status], {
    enabled: status !== "loading",
  });

  // Relit l'evenement (compteurs, statut d'inscription) sans repasser par l'etat de chargement.
  const refresh = async () => {
    try {
      setData(await publicApi.getEvent(id));
    } catch {
      // l'affichage precedent reste valable
    }
  };

  if (loading || status === "loading" || (!event && !error)) {
    return <div className="container section"><LoadingState label="Chargement de l’événement…" /></div>;
  }

  if (error) {
    return (
      <div className="container section">
        {isNotFound(error) ? (
          <EmptyState
            icon={CalendarX}
            title="Événement introuvable"
            description="Cet événement n’existe pas, n’est plus publié ou a déjà eu lieu."
            action={<Button href="/evenements">Retour à l’agenda</Button>}
          />
        ) : (
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="container pub-detail-head">
        <BackLink href="/evenements">Tout l’agenda</BackLink>
        <CoverImage src={event.image_url} variant="wide" priority />
        <div className="pub-detail-title">
          <div className="pub-event-when">
            <EventDate value={event.start_at} />
            <div>
              <strong>{formatDate(event.start_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
              <span className="muted">{eventTimeRange(event)}</span>
            </div>
          </div>
          <h1>{event.title}</h1>
        </div>
      </div>

      <section className="section section--tight">
        <div className="container pub-detail-layout">
          <div>
            <div className="pub-block">
              <h2>Au programme</h2>
              <div className="prose pub-prose">
                {paragraphs(event.description).map((text, index) => <p key={index}>{text}</p>)}
              </div>
            </div>
            <div className="pub-block">
              <h2>Informations pratiques</h2>
              <dl className="pub-facts">
                <div>
                  <dt><Clock aria-hidden="true" /> Horaires</dt>
                  <dd>{eventTimeRange(event)}</dd>
                </div>
                {event.location && (
                  <div>
                    <dt><MapPin aria-hidden="true" /> Lieu</dt>
                    <dd>{event.location}</dd>
                  </div>
                )}
                {event.region && (
                  <div>
                    <dt><MapIcon aria-hidden="true" /> Région</dt>
                    <dd>{event.region}</dd>
                  </div>
                )}
                <div>
                  <dt><Users aria-hidden="true" /> Capacité</dt>
                  <dd>{event.capacity ? plural(event.capacity, "place") : "Sans limite de places"}</dd>
                </div>
                {event.project_id && event.project_title && (
                  <div>
                    <dt><FolderOpen aria-hidden="true" /> Projet lié</dt>
                    <dd><Link href={`/projets/${event.project_id}`}>{event.project_title}</Link></dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
          <aside className="pub-aside" aria-label="Inscription">
            <RegistrationPanel event={event} onChange={refresh} />
          </aside>
        </div>
      </section>
    </>
  );
}
