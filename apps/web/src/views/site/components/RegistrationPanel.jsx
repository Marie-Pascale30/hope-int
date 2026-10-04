"use client";

// Inscription a un evenement. La page est rendue sans session : une fois connecte, l'evenement
// est relu cote client (compteurs a jour et statut d'inscription is_registered).
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, Card } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { useFormat } from "../../../i18n/format";
import { Link, useLocalePath } from "../../../i18n/navigation";
import { publicApi } from "../../../services";
import Swal from "sweetalert2";
import { toast } from "../../../utils/alerts";
import { errorMessage } from "../../../i18n/errors";
import { isPast, spotsStatus } from "./helpers";
import { invalidateMyEvents } from "./RegisteredBadge";

// Boites de dialogue (memes classes que utils/alerts.js) avec des boutons traduits.
const SWAL_CLASSES = {
  popup: "hope-swal-popup",
  title: "hope-swal-title",
  htmlContainer: "hope-swal-text",
  actions: "hope-swal-actions",
  confirmButton: "hope-swal-confirm",
  cancelButton: "hope-swal-cancel",
};
const swalBase = { width: "32rem", backdrop: "var(--backdrop)", buttonsStyling: false, customClass: SWAL_CLASSES };

function showError(title, text, closeText) {
  return Swal.fire({ ...swalBase, icon: "error", title, text, confirmButtonText: closeText });
}

async function confirmDanger(title, text, confirmText, cancelText) {
  const result = await Swal.fire({
    ...swalBase,
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    customClass: { ...SWAL_CLASSES, confirmButton: "hope-swal-danger" },
  });
  return result.isConfirmed;
}

export default function RegistrationPanel({ initialEvent }) {
  const t = useTranslations("site.eventDetail.registration");
  const tSpots = useTranslations("site.spots");
  const tErrors = useTranslations("errors");
  const f = useFormat();
  const lp = useLocalePath();
  const { status } = useAuth();
  const [event, setEvent] = useState(initialEvent);
  const [busy, setBusy] = useState(false);

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
      showError(t("registerError"), errorMessage(tErrors, err), tErrors("close"));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const unregister = async () => {
    const ok = await confirmDanger(t("cancelTitle"), t("cancelText"), t("cancelConfirm"), t("keep"));
    if (!ok) return;
    setBusy(true);
    try {
      await publicApi.unregisterEvent(event.id);
      invalidateMyEvents();
      toast(t("canceled"));
      await refresh();
    } catch (err) {
      showError(t("cancelError"), errorMessage(tErrors, err), tErrors("close"));
    } finally {
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
  } else if (full) {
    action = <Button size="lg" block disabled>{tSpots("full")}</Button>;
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
        <hr className="divider" style={{ margin: "6px 0" }} />
        {action}
      </div>
    </Card>
  );
}
