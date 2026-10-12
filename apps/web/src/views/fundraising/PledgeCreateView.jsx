"use client";

// Engagement de don mensuel par Mobile Money : montant en FCFA, jour du mois, projet facultatif.
// Chaque mois, un rappel par email apporte un lien de paiement pre-rempli.
import "../../styles/account.css";
import "../../styles/fundraising.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarHeart } from "lucide-react";
import { Alert, Button, Card, Input, Select, focusFirstInvalid } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useMeta } from "../../hooks/useMeta";
import { publicApi } from "../../services";
import { fundraisingApi } from "../../services/fundraising";
import { useFormat } from "../../i18n/format";
import { useErrorMessage } from "../../i18n/errors";
import { useLocalePath } from "../../i18n/navigation";
import { EMAIL_PATTERN } from "../account/components/authHelpers";
import { PLEDGE_DAY_RANGE } from "@hope/shared/fundraising";
import PledgeCard from "./components/PledgeCard";

const PRESETS = [2000, 5000, 10000, 25000];

export default function PledgeCreateView() {
  const t = useTranslations("fundraising.pledgeCreate");
  const f = useFormat();
  const lp = useLocalePath();
  const router = useRouter();
  const errorText = useErrorMessage();
  const { user, isAuthenticated } = useAuth();
  const { meta } = useMeta();
  const projects = useAsync(() => publicApi.listContent("projects"), []);
  const [form, setForm] = useState({ amount: "5000", dayOfMonth: "5", projectId: "", name: "", email: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const limits = meta.donationLimits.xaf;
  const amount = Math.round(Number(String(form.amount).replace(/\s/g, "")));
  const day = Number(form.dayOfMonth);
  const errors = {};
  if (!(amount >= limits.min && amount <= limits.max)) {
    errors.amount = t("errors.amount", { min: f.money(limits.min, "xaf"), max: f.money(limits.max, "xaf") });
  }
  if (!Number.isInteger(day) || day < PLEDGE_DAY_RANGE.min || day > PLEDGE_DAY_RANGE.max) errors.day = t("errors.day");
  if (!isAuthenticated && form.name.trim().length < 2) errors.name = t("errors.name");
  if (!isAuthenticated && !EMAIL_PATTERN.test(form.email.trim())) errors.email = t("errors.email");
  const shown = submitted ? errors : {};
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.keys(errors).length) {
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setSubmitting(true);
    try {
      const result = await fundraisingApi.createPledge({
        amount,
        dayOfMonth: day,
        projectId: form.projectId ? Number(form.projectId) : undefined,
        donorName: isAuthenticated ? undefined : form.name.trim(),
        donorEmail: isAuthenticated ? undefined : form.email.trim(),
      });
      if (!isAuthenticated && result.manageToken) {
        router.push(lp(`/collecte/engagement/${result.manageToken}?nouveau=1`));
        return;
      }
      setCreated(result.pledge);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const projectOptions = (projects.data || [])
    .filter((project) => project.status !== "termine")
    .map((project) => ({ value: String(project.id), label: project.title }));

  return (
    <div className="container fr-wrap">
      <span className="eyebrow">{t("eyebrow")}</span>
      <h1>{t("title")}</h1>
      <p className="lead">{t("lead")}</p>

      {created ? (
        <>
          <Alert tone="success" title={t("createdTitle")}>{t("createdText")}</Alert>
          <PledgeCard pledge={created} onUpdate={async (changes) => setCreated(await fundraisingApi.updatePledge(created.id, changes))} />
          <Button href={lp("/espace")} variant="ghost">{t("accountLink")}</Button>
        </>
      ) : (
        <Card>
          <form className="fr-form" onSubmit={submit} noValidate>
            <div className="don-amounts" role="radiogroup" aria-label={t("presets")}>
              {PRESETS.map((value) => (
                <label key={value} className={`don-amount${amount === value ? " is-checked" : ""}`}>
                  <input type="radio" name="engagement-montant" checked={amount === value} onChange={() => setForm((prev) => ({ ...prev, amount: String(value) }))} />
                  <span className="don-amount__value">{f.money(value, "xaf")}</span>
                </label>
              ))}
            </div>
            <div className="form-grid">
              <Input label={t("amount")} inputMode="numeric" required value={form.amount} onChange={set("amount")} error={shown.amount} />
              <Input
                label={t("day")}
                type="number"
                min={PLEDGE_DAY_RANGE.min}
                max={PLEDGE_DAY_RANGE.max}
                required
                value={form.dayOfMonth}
                onChange={set("dayOfMonth")}
                hint={t("dayHint")}
                error={shown.day}
              />
              <Select
                label={t("project")}
                value={form.projectId}
                onChange={set("projectId")}
                options={projectOptions}
                placeholder={t("generalFund")}
                full
              />
              {!isAuthenticated && (
                <>
                  <Input label={t("name")} autoComplete="name" required value={form.name} onChange={set("name")} error={shown.name} />
                  <Input label={t("email")} type="email" autoComplete="email" required value={form.email} onChange={set("email")} error={shown.email} hint={t("emailHint")} />
                </>
              )}
            </div>
            {isAuthenticated && <p className="muted">{t("as", { name: user.name, email: user.email })}</p>}
            <p className="muted fr-note">{t("howItWorks")}</p>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="fr-form__actions">
              <Button type="submit" variant="accent" icon={CalendarHeart} loading={submitting}>
                {t("submit", { amount: Number.isFinite(amount) && amount > 0 ? f.money(amount, "xaf") : "—" })}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
