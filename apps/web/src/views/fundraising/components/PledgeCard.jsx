"use client";

// Engagement de don mensuel Mobile Money : resume, regularite (echeances payees / manquees), lien de
// paiement du mois, lien WhatsApp a copier, modification, suspension et arret.
// onUpdate(changes) -> Promise<pledge mis a jour> (espace membre ou lien secret).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Pause, Play, Smartphone, Square } from "lucide-react";
import { Alert, Badge, Button, Card, Input } from "../../../components/ui";
import { useFormat } from "../../../i18n/format";
import { useErrorMessage } from "../../../i18n/errors";
import { toast, useAlerts } from "../../../utils/alerts";
import { PLEDGE_DAY_RANGE } from "@hope/shared/fundraising";

const STATUS_TONES = { active: "success", paused: "warning", stopped: "danger" };

export default function PledgeCard({ pledge, onUpdate }) {
  const t = useTranslations("fundraising.pledge");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { confirmAction } = useAlerts();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ amount: String(pledge.amount), dayOfMonth: String(pledge.day_of_month) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stopped = pledge.status === "stopped";
  const regularity = pledge.regularity || { periods: [], paid: 0, missed: 0, rate: null };

  const run = async (changes, message) => {
    setBusy(true);
    setError("");
    try {
      await onUpdate(changes);
      setEditing(false);
      if (message) toast(message);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    const ok = await confirmAction(t("stopTitle"), t("stopText"), t("stopConfirm"), { danger: true });
    if (ok) run({ status: "stopped" }, t("stopped"));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pledge.pay_url);
      toast(t("copied"));
    } catch {
      toast(t("copyFailed"), "error");
    }
  };

  const save = (event) => {
    event.preventDefault();
    run({ amount: Number(form.amount), dayOfMonth: Number(form.dayOfMonth) }, t("saved"));
  };

  return (
    <Card className="fr-item">
      <div className="fr-item__head">
        <h3 className="fr-item__title">
          {t("summary", { amount: f.money(pledge.amount, pledge.currency), day: pledge.day_of_month })}
        </h3>
        <Badge tone={STATUS_TONES[pledge.status]}>{t(`status.${pledge.status}`)}</Badge>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {pledge.project_title ? t("forProject", { project: pledge.project_title }) : t("generalFund")}
        {" · "}
        {t("since", { date: f.date(pledge.created_at) })}
      </p>

      <div>
        <p style={{ margin: "0 0 8px" }}>
          {regularity.rate === null
            ? t("regularityNone")
            : t("regularity", { paid: regularity.paid, missed: regularity.missed, rate: regularity.rate })}
        </p>
        {regularity.periods.length > 0 && (
          <ul className="fr-periods" aria-label={t("periodsLabel")}>
            {regularity.periods.map((item) => (
              <li key={item.period} className={`is-${item.status}`}>
                {item.period} · {t(`periodStatus.${item.status}`)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!stopped && pledge.pay_url && (
        <div className="fr-item__actions">
          <Button href={pledge.pay_url} variant="accent" size="sm" icon={Smartphone}>{t("payNow")}</Button>
          <Button variant="secondary" size="sm" icon={Copy} onClick={copy}>{t("copyLink")}</Button>
          {pledge.whatsapp_url && (
            <a className="btn btn--secondary btn--sm" href={pledge.whatsapp_url} target="_blank" rel="noopener noreferrer">
              {t("whatsapp")}
              <span className="visually-hidden"> {t("newWindow")}</span>
            </a>
          )}
        </div>
      )}

      {editing ? (
        <form className="fr-form" onSubmit={save} noValidate>
          <div className="form-grid">
            <Input
              label={t("amount")}
              inputMode="numeric"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            />
            <Input
              label={t("day")}
              type="number"
              min={PLEDGE_DAY_RANGE.min}
              max={PLEDGE_DAY_RANGE.max}
              value={form.dayOfMonth}
              onChange={(event) => setForm((prev) => ({ ...prev, dayOfMonth: event.target.value }))}
              hint={t("dayHint")}
            />
          </div>
          <div className="fr-form__actions">
            <Button type="submit" loading={busy}>{t("save")}</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>{t("cancel")}</Button>
          </div>
        </form>
      ) : (
        !stopped && (
          <div className="fr-item__actions">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>{t("edit")}</Button>
            {pledge.status === "active" ? (
              <Button variant="ghost" size="sm" icon={Pause} loading={busy} onClick={() => run({ status: "paused" }, t("paused"))}>
                {t("pause")}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" icon={Play} loading={busy} onClick={() => run({ status: "active" }, t("resumed"))}>
                {t("resume")}
              </Button>
            )}
            <Button variant="ghost" size="sm" icon={Square} onClick={stop}>{t("stop")}</Button>
          </div>
        )
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </Card>
  );
}
