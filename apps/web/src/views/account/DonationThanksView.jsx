"use client";

import "../../styles/account.css";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FolderHeart,
  Heart,
  RotateCcw,
  Share2,
  ShieldCheck,
  UserPlus,
  Wallet,
  XCircle,
} from "lucide-react";
import { Alert, Button, Card, ErrorState, LoadingState, StatusBadge } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { usePolling } from "../../hooks/usePolling";
import { paymentApi } from "../../services";
import { useFormat } from "../../i18n/format";
import { useLocalePath } from "../../i18n/navigation";
import { toast, useAlerts } from "../../utils/alerts";
import { useLabels } from "../../utils/labels";
import { useErrorMessage } from "../../i18n/errors";

const REF_PATTERN = /^[a-f0-9]{48}$/i;

// Paiement Mobile Money en attente : relecture toutes les 5 s pendant 2 min, puis verification manuelle.
// La relecture simple (GET) suit les webhooks ; une interrogation du prestataire est faite toutes les 30 s.
const POLL_INTERVAL = 5000;
const POLL_ATTEMPTS = 24;
const CONFIRM_EVERY = 6;

// Ecrans des dons non confirmes (hors attente) : remboursement, contestation, verification, echec.
// Textes : account.thanks.outcomes.<statut>.{eyebrow,title,lead}
const OUTCOMES = {
  review: { icon: ShieldCheck, tone: "pending", retry: false },
  disputed: { icon: AlertTriangle, tone: "failed", retry: false },
  refunded: { icon: XCircle, tone: "failed", retry: false },
  canceled: { icon: XCircle, tone: "failed", retry: true },
  failed: { icon: XCircle, tone: "failed", retry: true },
};

// Statuts annonces aux lecteurs d'ecran (account.thanks.live.<statut>).
const LIVE_STATUSES = ["succeeded", "review", "disputed", "refunded", "canceled", "failed"];

const refundedOf = (payment) => Number(payment.refunded_amount) || 0;

function ReceiptDetails({ payment }) {
  const t = useTranslations("account.thanks.details");
  const f = useFormat();
  const labels = useLabels();
  const refunded = refundedOf(payment);
  const amount = f.money(payment.amount, payment.currency);
  return (
    <dl className="dl don-thanks__dl">
      <dt>{t("amount")}</dt>
      <dd>{payment.frequency === "monthly" ? t("perMonth", { amount }) : amount}</dd>
      {refunded > 0 && payment.status === "succeeded" && (
        <>
          <dt>{t("refunded")}</dt>
          <dd>{f.money(refunded, payment.currency)}</dd>
        </>
      )}
      <dt>{t("project")}</dt>
      <dd>{payment.project_title || t("general")}</dd>
      <dt>{t("method")}</dt>
      <dd>
        {t("methodValue", { method: labels.method(payment.method), frequency: labels.frequency(payment.frequency) })}
      </dd>
      {payment.frequency === "monthly" && payment.subscription_status && (
        <>
          <dt>{t("subscription")}</dt>
          <dd><StatusBadge status={labels.status("subscriptionStatus", payment.subscription_status)} /></dd>
        </>
      )}
      {payment.paid_at && (
        <>
          <dt>{t("date")}</dt>
          <dd>{f.dateTime(payment.paid_at)}</dd>
        </>
      )}
      {payment.receipt_number && (
        <>
          <dt>{t("receiptNumber")}</dt>
          <dd><strong>{payment.receipt_number}</strong></dd>
        </>
      )}
    </dl>
  );
}

// t : useTranslations("account.thanks.share") ; path : page de don dans la langue courante.
async function share(t, path) {
  const url = `${window.location.origin}${path}`;
  const text = t("text");
  try {
    if (navigator.share) {
      await navigator.share({ title: "HOPE International", text, url });
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast(t("copied"));
    }
  } catch {
    // Partage annule par l'utilisateur : rien a signaler.
  }
}

// Don mensuel : arret sans compte via le jeton du recu ; un membre connecte passe par son espace.
function MonthlyControl({ payment, isAuthenticated, onCanceled }) {
  const t = useTranslations("account.thanks.monthly");
  const f = useFormat();
  const lp = useLocalePath();
  const { confirmAction } = useAlerts();
  const errorText = useErrorMessage();
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState("");

  if (payment.frequency !== "monthly" || !payment.subscription_id) return null;
  if (payment.subscription_status === "canceled") {
    return <p className="muted don-thanks__note">{t("stopped")}</p>;
  }
  if (isAuthenticated) {
    return (
      <div className="don-thanks__monthly">
        <p className="muted don-thanks__note">{t("fromAccount")}</p>
        <Button href={lp("/espace")} variant="ghost" size="sm">{t("accountLink")}</Button>
      </div>
    );
  }

  const stop = async () => {
    const amount = f.money(payment.amount, payment.currency);
    const ok = await confirmAction(t("confirmTitle"), t("confirmText", { amount }), t("confirmButton"), { danger: true });
    if (!ok) return;
    setStopping(true);
    setStopError("");
    try {
      const result = await paymentApi.cancelSubscriptionByReceipt(payment.receipt_token);
      onCanceled();
      toast(result?.message || t("done"));
    } catch (err) {
      setStopError(errorText(err));
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="don-thanks__monthly">
      <p className="muted don-thanks__note">{t("stopHint")}</p>
      <Button variant="ghost" size="sm" onClick={stop} loading={stopping}>{t("stopButton")}</Button>
      {stopError && <Alert tone="danger" title={t("errorTitle")}>{stopError}</Alert>}
    </div>
  );
}

function Success({ payment, isAuthenticated, onSubscriptionCanceled }) {
  const t = useTranslations("account.thanks.success");
  const tShare = useTranslations("account.thanks.share");
  const f = useFormat();
  const lp = useLocalePath();
  const firstName = (payment.donor_name || "").split(" ")[0];
  const refunded = refundedOf(payment);
  return (
    <>
      <div className="don-thanks__head">
        <span className="don-thanks__icon don-thanks__icon--success"><CheckCircle2 size={36} aria-hidden="true" /></span>
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1>{firstName ? t("titleNamed", { name: firstName }) : t("title")}</h1>
        <p className="lead">
          {t.rich("lead", {
            amount: f.money(payment.amount, payment.currency),
            frequency: payment.frequency === "monthly" ? "monthly" : "once",
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </div>
      <Card className="don-thanks__card">
        <ReceiptDetails payment={payment} />
        {refunded > 0 && <Alert tone="info">{t("partialRefund", { amount: f.money(refunded, payment.currency) })}</Alert>}
        <div className="don-thanks__actions">
          <Button
            href={paymentApi.receiptPdfUrl(payment.receipt_token)}
            target="_blank"
            rel="noopener noreferrer"
            icon={Download}
          >
            {t("download")}
          </Button>
        </div>
        <p className="muted don-thanks__note">{t("receiptSent")}</p>
        <MonthlyControl payment={payment} isAuthenticated={isAuthenticated} onCanceled={onSubscriptionCanceled} />
      </Card>
      <div className="don-thanks__next">
        <Card hover className="don-next">
          <FolderHeart aria-hidden="true" />
          <h2>{t("next.projectsTitle")}</h2>
          <p className="muted">{t("next.projectsText")}</p>
          <Button href={lp("/projets")} variant="secondary" size="sm">{t("next.projectsButton")}</Button>
        </Card>
        <Card hover className="don-next">
          <Share2 aria-hidden="true" />
          <h2>{t("next.shareTitle")}</h2>
          <p className="muted">{t("next.shareText")}</p>
          <Button variant="secondary" size="sm" onClick={() => share(tShare, lp("/don"))}>{t("next.shareButton")}</Button>
        </Card>
        {isAuthenticated ? (
          <Card hover className="don-next">
            <Wallet aria-hidden="true" />
            <h2>{t("next.accountTitle")}</h2>
            <p className="muted">{t("next.accountText")}</p>
            <Button href={lp("/espace")} variant="secondary" size="sm">{t("next.accountButton")}</Button>
          </Card>
        ) : (
          <Card hover className="don-next">
            <UserPlus aria-hidden="true" />
            <h2>{t("next.registerTitle")}</h2>
            <p className="muted">{t("next.registerText")}</p>
            <Button href={lp("/inscription")} variant="secondary" size="sm">{t("next.registerButton")}</Button>
          </Card>
        )}
      </div>
    </>
  );
}

function Pending({ payment, onCheck, checking, polling }) {
  const t = useTranslations("account.thanks.pending");
  const lp = useLocalePath();
  return (
    <>
      <div className="don-thanks__head">
        <span className="don-thanks__icon don-thanks__icon--pending"><Clock size={36} aria-hidden="true" /></span>
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1>{t("title")}</h1>
        <p className="lead">{t("lead")}</p>
      </div>
      <Card className="don-thanks__card">
        <ReceiptDetails payment={payment} />
        {polling === "running" && (
          <p className="don-thanks__polling">
            <span className="spinner spinner--sm" aria-hidden="true" />
            {t("pollingNote")}
          </p>
        )}
        {polling === "exhausted" && <p className="muted don-thanks__note don-thanks__note--before">{t("pollingPaused")}</p>}
        <div className="don-thanks__actions">
          {polling !== "running" && (
            <Button icon={RotateCcw} loading={checking} onClick={onCheck}>{t("checkAgain")}</Button>
          )}
          <Button href={lp("/")} variant="ghost">{t("home")}</Button>
        </div>
      </Card>
    </>
  );
}

function Outcome({ payment }) {
  const t = useTranslations("account.thanks.outcomes");
  const lp = useLocalePath();
  const status = OUTCOMES[payment.status] ? payment.status : "failed";
  const screen = OUTCOMES[status];
  const retry = lp(payment.project_id ? `/don?projet=${payment.project_id}` : "/don");
  return (
    <>
      <div className="don-thanks__head">
        <span className={`don-thanks__icon don-thanks__icon--${screen.tone}`}><screen.icon size={36} aria-hidden="true" /></span>
        <span className="eyebrow">{t(`${status}.eyebrow`)}</span>
        <h1>{t(`${status}.title`)}</h1>
        <p className="lead">{t(`${status}.lead`)}</p>
      </div>
      <Card className="don-thanks__card">
        <ReceiptDetails payment={payment} />
        <div className="don-thanks__actions">
          {screen.retry && <Button href={retry} variant="accent" icon={Heart}>{t("retry")}</Button>}
          <Button href={lp("/contact")} variant={screen.retry ? "ghost" : "secondary"}>{t("contact")}</Button>
          {!screen.retry && <Button href={lp("/")} variant="ghost">{t("home")}</Button>}
        </div>
      </Card>
    </>
  );
}

export default function DonationThanksView() {
  const t = useTranslations("account.thanks");
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const params = useSearchParams();
  const { isAuthenticated } = useAuth();
  const ref = params.get("ref") || "";
  const transactionId = params.get("transaction_id") || undefined;
  const redirectStatus = params.get("status") || undefined;
  const valid = REF_PATTERN.test(ref);

  const { data: payment, loading, error, reload, setData } = useAsync(
    () => paymentApi.confirmReceipt(ref, { transactionId, status: redirectStatus }),
    [ref],
    { enabled: valid }
  );

  const awaitingMobile = payment?.status === "pending" && payment.method === "mobile_money";
  const poll = usePolling(
    async (attempt) => {
      const next = attempt % CONFIRM_EVERY === 0
        ? await paymentApi.confirmReceipt(ref, { transactionId })
        : await paymentApi.getReceipt(ref);
      if (next) setData(next);
    },
    { active: valid && awaitingMobile, interval: POLL_INTERVAL, maxAttempts: POLL_ATTEMPTS }
  );
  const pollingState = !awaitingMobile ? "off" : poll.polling ? "running" : "exhausted";

  const cancelSubscriptionLocally = () => setData((current) => (current ? { ...current, subscription_status: "canceled" } : current));

  // Annonce des changements d'etat aux lecteurs d'ecran (region persistante, polie).
  let announcement = "";
  if (payment?.status === "pending") {
    announcement = pollingState === "running"
      ? t("live.pendingPolling")
      : pollingState === "exhausted" ? t("live.pendingExhausted") : t("live.pendingIdle");
  } else if (payment) {
    announcement = t(`live.${LIVE_STATUSES.includes(payment.status) ? payment.status : "failed"}`);
  }

  let content;
  if (!valid) {
    content = (
      <ErrorState
        title={t("invalid.title")}
        message={t("invalid.text")}
      />
    );
  } else if (!payment && loading) {
    content = <LoadingState label={t("checking")} />;
  } else if (!payment) {
    const notFound = error?.response?.status === 404;
    content = (
      <ErrorState
        title={notFound ? t("notFound.title") : t("checkError")}
        message={notFound ? t("notFound.text") : errorText(error)}
        onRetry={notFound ? undefined : reload}
      />
    );
  } else if (payment.status === "succeeded") {
    content = <Success payment={payment} isAuthenticated={isAuthenticated} onSubscriptionCanceled={cancelSubscriptionLocally} />;
  } else if (payment.status === "pending") {
    content = <Pending payment={payment} onCheck={reload} checking={loading} polling={pollingState} />;
  } else {
    content = <Outcome payment={payment} />;
  }

  return (
    <section className="section--tight don-thanks">
      <div className="container don-thanks__inner">
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</p>
        {content}
        {(!valid || (!payment && !loading)) && (
          <div className="don-thanks__actions don-thanks__actions--center">
            <Button href={lp("/don")} variant="accent" icon={Heart}>{t("donate")}</Button>
            <Button href={lp("/espace")} variant="ghost">{t("account")}</Button>
          </div>
        )}
      </div>
    </section>
  );
}
