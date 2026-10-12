"use client";

// Inscription a un evenement. La page est rendue sans session : une fois connecte, l'evenement
// est relu cote client (compteurs a jour et statut d'inscription is_registered).
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Hourglass, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, Card } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useFormat } from "@/src/i18n/format";
import { Link, useLocalePath } from "@/src/i18n/navigation";
import { publicApi } from "@/src/services";
import { volunteeringApi } from "@/src/services/volunteering";
import { useAlerts } from "@/src/utils/alerts";
import { errorMessage } from "@/src/i18n/errors";
import { isPast, spotsStatus } from "./helpers";
import { invalidateMyEvents } from "./RegisteredBadge";

export default function RegistrationPanel({ initialEvent }) {
  const t = useTranslations("site.eventDetail.registration");
  const tSpots = useTranslations("site.spots");
  const tErrors = useTranslations("errors");
  const tWait = useTranslations("volunteering.waitlist");
  const f = useFormat();
  const lp = useLocalePath();
  const { status } = useAuth();
  const [event, setEvent] = useState(initialEvent);
  const [busy, setBusy] = useState(false);
  const { toast, showError, confirmAction } = useAlerts();

  const refresh = useCallback(async () => {
    try {
      setEvent(await publicApi.getEvent(initialEvent.id));
    } catch {
      // l'affichage precedent reste valable
    }
  }, [initialEvent.id]);

  useEffect(() => {
    if (status === "authenticated") refresh();
  }, [status, refresh]);

  const spots = spotsStatus(event, tSpots);
  const full = event.remaining_spots !== null && event.remaining_spots !== undefined && event.remaining_spots <= 0;
  const past = isPast(event);

  const register = async () => {
    setBusy(true);
    try {
      await publicApi.registerEvent(event.id);
      invalidateMyEvents();
      toast(t("registered"));
    } catch (err) {
      showError(t("registerError"), errorMessage(tErrors, err));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const unregister = async () => {
    const ok = await confirmAction(t("cancelTitle"), t("cancelText"), t("cancelConfirm"), { danger: true, cancelText: t("keep") });
    if (!ok) return;
    setBusy(true);
    try {
      await publicApi.unregisterEvent(event.id);
      invalidateMyEvents();
      toast(t("canceled"));
      await refresh();
    } catch (err) {
      showError(t("cancelError"), errorMessage(tErrors, err));
    } finally {
      setBusy(false);
    }
  };

  // Liste d'attente (evenement complet) : inscription en attente, rang, sortie de la liste.
  const joinWaitlist = async () => {
    setBusy(true);
    try {
      const result = await volunteeringApi.joinWaitlist(event.id);
      invalidateMyEvents();
      toast(result.status === "registered" ? t("registered") : tWait("joined", { position: result.position }));
    } catch (err) {
      showError(tWait("joinError"), errorMessage(tErrors, err));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const leaveWaitlist = async () => {
    const ok = await confirmAction(tWait("leaveTitle"), tWait("leaveText"), tWait("leaveConfirm"), { danger: true, cancelText: t("keep") });
    if (!ok) return;
    setBusy(true);
    try {
      await volunteeringApi.leaveWaitlist(event.id);
      invalidateMyEvents();
      toast(tWait("left"));
    } catch (err) {
      showError(tWait("leaveError"), errorMessage(tErrors, err));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  let action;
  if (past) {
    action = <Alert tone="info">{t("past")}</Alert>;
  } else if (status === "loading") {
    action = <Button block loading disabled>{t("checking")}</Button>;
  } else if (status !== "authenticated") {
    action = (
      <>
        <Button href={lp(`/connexion?next=${encodeURIComponent(lp(`/evenements/${event.id}`))}`)} size="lg" icon={LogIn} block>
          {t("login")}
        </Button>
        <p className="pub-aside__note">
          {t.rich("noAccount", { link: (chunks) => <Link href="/inscription">{chunks}</Link> })}
        </p>
      </>
    );
  } else if (event.is_registered) {
    action = (
      <>
        <div className="pub-registered"><CheckCircle2 aria-hidden="true" /> {t("youAreRegistered")}</div>
        <Button variant="secondary" block loading={busy} onClick={unregister}>{t("cancel")}</Button>
      </>
    );
  } else if (event.my_status === "waitlisted") {
    action = (
      <>
        <div className="pub-registered"><Hourglass aria-hidden="true" /> {tWait("position", { position: event.waitlist_position })}</div>
        <p className="pub-aside__note">{tWait("positionHint")}</p>
        <Button variant="secondary" block loading={busy} onClick={leaveWaitlist}>{tWait("leave")}</Button>
      </>
    );
  } else if (full) {
    action = (
      <>
        <p className="pub-aside__note">{tWait("fullHint")}</p>
        <Button size="lg" variant="accent" block loading={busy} onClick={joinWaitlist}>{tWait("join")}</Button>
      </>
    );
  } else {
    action = <Button size="lg" variant="accent" block loading={busy} onClick={register}>{t("register")}</Button>;
  }

  return (
    <Card>
      <h2 className="pub-aside__title">{t("title")}</h2>
      <div className="stack" style={{ gap: 10 }}>
        <div className="row row--between">
          <span className="muted">{t("spots")}</span>
          <Badge tone={spots.tone}>{spots.label}</Badge>
        </div>
        <div className="row row--between">
          <span className="muted">{t("participants")}</span>
          <strong>{f.number(event.registered_count)}{event.capacity ? ` / ${f.number(event.capacity)}` : ""}</strong>
        </div>
        {event.waitlist_count > 0 && (
          <div className="row row--between">
            <span className="muted">{tWait("label")}</span>
            <strong>{tWait("count", { count: event.waitlist_count })}</strong>
          </div>
        )}
        <hr className="divider" style={{ margin: "6px 0" }} />
        {action}
      </div>
    </Card>
  );
}
