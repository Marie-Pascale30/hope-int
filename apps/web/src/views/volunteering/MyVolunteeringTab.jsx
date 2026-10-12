"use client";

// Onglet « Mon bénévolat » de l'espace membre : compteur d'heures, badges, historique et
// attestations (emission sur une periode, telechargement PDF, lien de verification).
import { useState } from "react";
import { CalendarDays, Download, FileCheck2, HandHeart, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, StatCard } from "@/src/components/ui";
import { useAsync } from "@/src/hooks/useAsync";
import { useFormat } from "@/src/i18n/format";
import { useErrorMessage } from "@/src/i18n/errors";
import { Link, useLocalePath } from "@/src/i18n/navigation";
import { volunteeringApi } from "@/src/services/volunteering";
import { useAlerts } from "@/src/utils/alerts";
import { saveBlob } from "@/src/utils/format";
import BadgeList from "./BadgeList";
import "./volunteering.css";

function CertificateForm({ today, firstDay, onIssued }) {
  const t = useTranslations("volunteering.certificates");
  const errorText = useErrorMessage();
  const { showError, toast } = useAlerts();
  const [from, setFrom] = useState(firstDay || "");
  const [to, setTo] = useState(today || "");
  const [busy, setBusy] = useState(false);
  const invalid = from && to && from > to;

  const submit = async (event) => {
    event.preventDefault();
    if (invalid) return;
    setBusy(true);
    try {
      const certificate = await volunteeringApi.issueCertificate({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
      toast(t("issued"));
      onIssued(certificate);
    } catch (err) {
      showError(t("failed"), errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="vol-cert-form" onSubmit={submit}>
      <Input label={t("from")} type="date" value={from} max={to || today} onChange={(event) => setFrom(event.target.value)} />
      <Input
        label={t("to")}
        type="date"
        value={to}
        min={from || undefined}
        max={today}
        onChange={(event) => setTo(event.target.value)}
        error={invalid ? t("invalidPeriod") : undefined}
      />
      <Button type="submit" icon={FileCheck2} loading={busy} disabled={invalid}>{t("generate")}</Button>
    </form>
  );
}

function CertificateRow({ certificate }) {
  const t = useTranslations("volunteering.certificates");
  const f = useFormat();
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const { showError } = useAlerts();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await volunteeringApi.certificatePdf(certificate.code);
      saveBlob(blob, `attestation-benevolat-${certificate.code}.pdf`);
    } catch (err) {
      showError(t("downloadFailed"), errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="vol-cert">
      <div className="cell-main">
        <strong>{t("period", { from: f.date(certificate.period_start), to: f.date(certificate.period_end) })}</strong>
        <span>
          {t("summary", { hours: f.number(certificate.total_hours, { maximumFractionDigits: 2 }), date: f.date(certificate.issued_at) })}
          {" · "}
          <code>{certificate.code}</code>
        </span>
      </div>
      <div className="row">
        <Button size="sm" variant="ghost" icon={Link2} href={lp(`/attestation/${certificate.code}`)} target="_blank">
          {t("verifyLink")}
        </Button>
        <Button size="sm" variant="secondary" icon={Download} loading={busy} onClick={download}>{t("download")}</Button>
      </div>
    </li>
  );
}

export default function MyVolunteeringTab() {
  const t = useTranslations("volunteering.mine");
  const tCert = useTranslations("volunteering.certificates");
  const f = useFormat();
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const { data, loading, error, reload, setData } = useAsync(() => volunteeringApi.mine(), []);

  if (loading && !data) return <LoadingState label={t("loading")} />;
  if (error && !data) return <ErrorState message={errorText(error)} onRetry={reload} />;

  const { totals, badges = [], history = [], certificates = [], today } = data;
  const hours = (value) => t("hours", { hours: f.number(value, { maximumFractionDigits: 2 }) });
  const firstDay = totals.firstActivityAt ? f.dayKey(totals.firstActivityAt) : "";

  const onIssued = (certificate) =>
    setData((prev) => ({
      ...prev,
      certificates: [certificate, ...(prev.certificates || []).filter((item) => item.code !== certificate.code)],
    }));

  return (
    <div className="stack acc-tab">
      <div className="vol-stats">
        <StatCard icon={HandHeart} label={t("counters.total")} value={hours(totals.hours)} tone="accent" />
        <StatCard icon={CalendarDays} label={t("counters.events")} value={f.number(totals.events)} hint={hours(totals.eventHours)} />
        <StatCard label={t("counters.missions")} value={f.number(totals.missions)} hint={hours(totals.otherHours)} />
        <StatCard
          label={t("counters.since")}
          value={totals.firstActivityAt ? f.date(totals.firstActivityAt, { month: "long", year: "numeric" }) : "—"}
        />
      </div>

      <section className="stack" aria-labelledby="vol-badges-title">
        <h2 id="vol-badges-title" className="acc-section-title">{t("badgesTitle")}</h2>
        <BadgeList badges={badges} />
      </section>

      <section className="stack" aria-labelledby="vol-history-title">
        <div className="row row--between">
          <h2 id="vol-history-title" className="acc-section-title">{t("historyTitle")}</h2>
          <Button href={lp("/evenements")} size="sm" variant="secondary" icon={CalendarDays}>{t("agenda")}</Button>
        </div>
        {history.length ? (
          <Card pad={false}>
            <ul className="vol-history">
              {history.map((item) => (
                <li key={item.id}>
                  <span className="vol-history__date">{f.date(item.day || item.date)}</span>
                  <span className="cell-main">
                    <strong>
                      {item.kind === "event" ? <Link href={`/evenements/${item.event_id}`}>{item.title}</Link> : item.title}
                    </strong>
                    <span>
                      {t(`kinds.${item.kind}`)}
                      {item.location ? ` · ${item.location}` : ""}
                      {item.description ? ` · ${item.description}` : ""}
                    </span>
                  </span>
                  <strong className="vol-history__hours">{hours(item.hours)}</strong>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState
            icon={HandHeart}
            title={t("emptyTitle")}
            description={t("emptyText")}
            action={<Button href={lp("/evenements")}>{t("agenda")}</Button>}
          />
        )}
      </section>

      <section className="stack" aria-labelledby="vol-cert-title">
        <h2 id="vol-cert-title" className="acc-section-title">{tCert("title")}</h2>
        <p className="muted">{tCert("intro")}</p>
        {totals.hours > 0 ? (
          <Card>
            <CertificateForm today={today} firstDay={firstDay} onIssued={onIssued} />
          </Card>
        ) : (
          <p className="muted">{tCert("noHours")}</p>
        )}
        {certificates.length > 0 && (
          <ul className="vol-certs" aria-label={tCert("list")}>
            {certificates.map((certificate) => <CertificateRow key={certificate.code} certificate={certificate} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
