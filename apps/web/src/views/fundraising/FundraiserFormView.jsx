"use client";

// Creation (ou modification avant publication, ?id=) d'une collecte personnelle par un membre.
// La collecte est relue par l'equipe avant d'etre publiee.
import "../../styles/account.css";
import "../../styles/fundraising.css";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Megaphone } from "lucide-react";
import { Alert, Button, Card, Input, Select, Textarea, focusFirstInvalid } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { publicApi } from "../../services";
import { fundraisingApi } from "../../services/fundraising";
import { useFormat } from "../../i18n/format";
import { useErrorMessage } from "../../i18n/errors";
import { useLocalePath } from "../../i18n/navigation";
import { FUNDRAISER_GOAL, FUNDRAISER_LIMITS } from "@hope/shared/fundraising";

const EMPTY = { projectId: "", title: "", story: "", goalAmount: "", currency: "eur", endsOn: "" };
const IMAGE_TYPES = "image/jpeg,image/png,image/webp";

function FundraiserForm() {
  const t = useTranslations("fundraising.form");
  const f = useFormat();
  const lp = useLocalePath();
  const router = useRouter();
  const params = useSearchParams();
  const errorText = useErrorMessage();
  const editId = /^\d+$/.test(params.get("id") || "") ? Number(params.get("id")) : null;
  const projects = useAsync(() => publicApi.listContent("projects"), []);
  const mine = useAsync(() => fundraisingApi.myFundraisers(), [], { enabled: Boolean(editId) });
  const existing = useMemo(() => (mine.data || []).find((item) => item.id === editId) || null, [mine.data, editId]);
  const [form, setForm] = useState(null);
  const [image, setImage] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const values = form ?? (existing
    ? {
      projectId: String(existing.project_id),
      title: existing.title,
      story: existing.story,
      goalAmount: String(existing.goal_amount),
      currency: existing.currency,
      endsOn: existing.ends_on || "",
    }
    : EMPTY);
  const set = (key) => (event) => setForm({ ...values, [key]: event.target.value });

  const goal = Number(String(values.goalAmount).replace(",", "."));
  const limits = FUNDRAISER_GOAL[values.currency];
  const errors = {};
  if (!values.projectId) errors.projectId = t("errors.project");
  if (values.title.trim().length < 5) errors.title = t("errors.title");
  if (values.story.trim().length < FUNDRAISER_LIMITS.storyMin) errors.story = t("errors.story", { min: FUNDRAISER_LIMITS.storyMin });
  if (!(goal >= limits.min && goal <= limits.max)) {
    errors.goalAmount = t("errors.goal", { min: f.money(limits.min, values.currency), max: f.money(limits.max, values.currency) });
  }
  const shown = submitted ? errors : {};
  const locked = existing && !["pending", "rejected"].includes(existing.status);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.keys(errors).length) {
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        projectId: Number(values.projectId),
        title: values.title.trim(),
        story: values.story.trim(),
        goalAmount: goal,
        currency: values.currency,
        endsOn: values.endsOn || undefined,
        image: image || undefined,
      };
      if (existing) await fundraisingApi.updateFundraiser(existing.id, payload);
      else await fundraisingApi.createFundraiser(payload);
      router.push(lp("/espace?collecte=envoyee"));
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  };

  const projectOptions = (projects.data || [])
    .filter((project) => project.status !== "termine")
    .map((project) => ({ value: String(project.id), label: project.title }));

  return (
    <div className="container fr-wrap">
      <span className="eyebrow">{t("eyebrow")}</span>
      <h1>{existing ? t("editTitle") : t("title")}</h1>
      <p className="lead">{t("lead")}</p>
      {existing?.status === "rejected" && existing.moderation_note && (
        <Alert tone="warning" title={t("rejectedTitle")}>{existing.moderation_note}</Alert>
      )}
      {locked ? (
        <Alert tone="info">{t("locked")}</Alert>
      ) : (
        <Card>
          <form className="fr-form" onSubmit={submit} noValidate>
            <Select
              label={t("project")}
              required
              value={values.projectId}
              onChange={set("projectId")}
              options={projectOptions}
              placeholder={t("projectPlaceholder")}
              error={shown.projectId}
            />
            <Input label={t("titleLabel")} required maxLength={FUNDRAISER_LIMITS.title} value={values.title} onChange={set("title")} error={shown.title} hint={t("titleHint")} />
            <Textarea
              label={t("story")}
              required
              rows={8}
              maxLength={FUNDRAISER_LIMITS.story}
              value={values.story}
              onChange={set("story")}
              error={shown.story}
              hint={t("storyHint", { count: FUNDRAISER_LIMITS.story - values.story.length })}
            />
            <div className="form-grid">
              <Input label={t("goal")} inputMode="decimal" required value={values.goalAmount} onChange={set("goalAmount")} error={shown.goalAmount} />
              <Select
                label={t("currency")}
                value={values.currency}
                onChange={set("currency")}
                options={[{ value: "eur", label: t("currencies.eur") }, { value: "xaf", label: t("currencies.xaf") }]}
              />
              <Input label={t("endsOn")} type="date" value={values.endsOn} onChange={set("endsOn")} hint={t("endsOnHint")} />
              <Input
                label={t("image")}
                type="file"
                accept={IMAGE_TYPES}
                onChange={(event) => setImage(event.target.files?.[0] || null)}
                hint={t("imageHint")}
              />
            </div>
            <p className="muted fr-note">{t("moderationNote")}</p>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="fr-form__actions">
              <Button type="submit" variant="accent" icon={Megaphone} loading={saving}>{existing ? t("resubmit") : t("submit")}</Button>
              <Button href={lp("/espace")} variant="ghost">{t("cancel")}</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export default function FundraiserFormView() {
  return (
    <RequireAuth>
      <FundraiserForm />
    </RequireAuth>
  );
}
