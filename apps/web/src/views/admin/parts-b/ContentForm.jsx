"use client";

// Formulaire (en modale) de creation / modification d'un projet, d'une actualite ou d'un temoignage.
import { useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Input, Modal, Select, Switch, Textarea, focusFirstInvalid } from "../../../components/ui";
import { useMeta, regionOptions } from "../../../hooks/useMeta";
import { adminApi } from "../../../services";
import { useErrorMessage } from "../../../i18n/errors";
import { STATUS_KEYS } from "../../../utils/labels";
import { useAlerts } from "../../../utils/alerts";
import { ImageField } from "./widgets";

const FORM_ID = "adm-content-form";
const SUMMARY_MAX = 500;

// Champs editables par type (valeurs vides par defaut).
export const CONTENT_FIELDS = {
  projects: {
    title: "", summary: "", description: "", status: "planifie", region: "", start_date: "", end_date: "",
    budget: "", goal_amount: "", beneficiaries: "", trainees: "", credits_granted: "",
  },
  news: { title: "", summary: "", content: "", project_id: "" },
  testimonials: { author: "", role_label: "", content: "", project_id: "" },
};

// Valeurs du formulaire a partir d'un contenu existant (null -> "").
export function toFormValues(type, item) {
  const defaults = CONTENT_FIELDS[type];
  if (!item) return { ...defaults };
  return Object.fromEntries(
    Object.keys(defaults).map((key) => {
      const value = item[key];
      if (value === null || value === undefined) return [key, key === "status" ? defaults.status : ""];
      return [key, String(value)];
    })
  );
}

function SummaryCounter({ value }) {
  const t = useTranslations("adminOps.contentForm");
  return <span className="adm-counter">{t("counter", { count: value.length, max: SUMMARY_MAX })}</span>;
}

// scopedRegion : region imposee a une directrice regionale (null = pas de restriction).
export default function ContentForm({ type, item, projects = [], scopedRegion = null, onClose, onSaved }) {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.contentForm");
  const tType = useTranslations(`adminOps.content.types.${type}`);
  const { showError, toast } = useAlerts();
  const { meta } = useMeta();
  const [values, setValues] = useState(() => {
    const initial = toFormValues(type, item);
    if (type === "projects" && scopedRegion && !item) initial.region = scopedRegion;
    return initial;
  });
  const [published, setPublished] = useState(item ? Boolean(item.published) : false);
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [projectError, setProjectError] = useState("");

  const restricted = scopedRegion !== null;
  const projectRequired = restricted && type !== "projects";
  const set = (key) => (event) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
    if (key === "project_id") setProjectError("");
  };
  const projectOptions = projects.map((project) => ({
    value: String(project.id),
    label: project.region ? `${project.title} · ${project.region}` : project.title,
  }));
  // Contenu deja rattache a un projet absent de la liste (hors region) : garde l'option visible.
  if (values.project_id && !projectOptions.some((option) => option.value === values.project_id)) {
    projectOptions.push({ value: values.project_id, label: t("projectUnavailable", { id: values.project_id }) });
  }
  const statusOptions = STATUS_KEYS.projectStatus.map((value) => ({ value, label: t(`status.${value}`) }));
  const datesInvalid = type === "projects" && values.start_date && values.end_date && values.end_date < values.start_date;

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (datesInvalid) return;
    if (projectRequired && !values.project_id) {
      setProjectError(t("projectRequired"));
      focusFirstInvalid(form);
      return;
    }
    setSaving(true);
    setServerError("");
    const payload = { ...values, published };
    if (file) payload.image = file;
    else if (removeImage) payload.remove_image = "1";
    try {
      const saved = item
        ? await adminApi.updateContent(type, item.id, payload)
        : await adminApi.createContent(type, payload);
      toast(item ? t("saved") : tType("created"));
      onSaved(saved, Boolean(item));
    } catch (err) {
      // Message deja traduit par l'API (ex. 403 hors region, image refusee).
      const message = getErrorMessage(err);
      setServerError(message);
      showError(t("saveFailed"), message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      large
      title={item ? tType("edit") : tType("create")}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" form={FORM_ID} icon={Save} loading={saving}>
            {item ? t("save") : t("create")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        {serverError && <Alert tone="danger" title={t("serverRefused")}>{serverError}</Alert>}
        <h3 className="adm-form-section">{t("sections.content")}</h3>
        <div className="form-grid">
          {type === "testimonials" ? (
            <>
              <Input
                label={t("fields.author")}
                required
                maxLength={150}
                value={values.author}
                onChange={set("author")}
                placeholder={t("placeholders.author")}
              />
              <Input
                label={t("fields.roleLabel")}
                maxLength={150}
                value={values.role_label}
                onChange={set("role_label")}
                placeholder={t("placeholders.roleLabel")}
              />
              <Textarea
                label={t("fields.testimonial")}
                required
                full
                rows={6}
                value={values.content}
                onChange={set("content")}
                hint={t("hints.testimonial")}
              />
            </>
          ) : (
            <>
              <Input label={t("fields.title")} required full maxLength={255} value={values.title} onChange={set("title")} />
              <Textarea
                label={<>{t("fields.summary")} <SummaryCounter value={values.summary} /></>}
                full
                rows={2}
                maxLength={SUMMARY_MAX}
                value={values.summary}
                onChange={set("summary")}
                hint={t("hints.summary")}
              />
              {type === "projects" ? (
                <Textarea label={t("fields.description")} required full rows={8} value={values.description} onChange={set("description")} />
              ) : (
                <Textarea label={t("fields.content")} required full rows={10} value={values.content} onChange={set("content")} />
              )}
            </>
          )}
          {type !== "projects" && (
            <Select
              label={t("fields.project")}
              placeholder={projectRequired ? t("placeholders.chooseProject") : t("placeholders.noProject")}
              options={projectOptions}
              value={values.project_id}
              onChange={set("project_id")}
              required={projectRequired}
              error={projectError || undefined}
              hint={projectRequired ? t("hints.projectScoped", { region: scopedRegion || "—" }) : t("hints.project")}
            />
          )}
        </div>

        {type === "projects" && (
          <>
            <h3 className="adm-form-section">{t("sections.frame")}</h3>
            <div className="form-grid">
              <Select label={t("fields.status")} options={statusOptions} value={values.status} onChange={set("status")} />
              {restricted ? (
                <Input
                  label={t("fields.region")}
                  value={scopedRegion || values.region || "—"}
                  readOnly
                  disabled
                  hint={t("hints.regionScoped")}
                />
              ) : (
                <Select
                  label={t("fields.region")}
                  placeholder={t("placeholders.noRegion")}
                  options={regionOptions(meta)}
                  value={values.region}
                  onChange={set("region")}
                />
              )}
              <Input label={t("fields.startDate")} type="date" value={values.start_date} onChange={set("start_date")} />
              <Input
                label={t("fields.endDate")}
                type="date"
                value={values.end_date}
                onChange={set("end_date")}
                min={values.start_date || undefined}
                error={datesInvalid ? t("errors.dates") : undefined}
              />
              <Input label={t("fields.budget")} type="number" min={0} step="0.01" value={values.budget} onChange={set("budget")} />
              <Input
                label={t("fields.goal")}
                type="number"
                min={0}
                step="1"
                value={values.goal_amount}
                onChange={set("goal_amount")}
                hint={t("hints.goal")}
              />
            </div>

            <h3 className="adm-form-section">{t("sections.impact")}</h3>
            <div className="form-grid">
              <Input label={t("fields.beneficiaries")} type="number" min={0} step="1" value={values.beneficiaries} onChange={set("beneficiaries")} />
              <Input label={t("fields.trainees")} type="number" min={0} step="1" value={values.trainees} onChange={set("trainees")} />
              <Input label={t("fields.credits")} type="number" min={0} step="1" value={values.credits_granted} onChange={set("credits_granted")} />
            </div>
          </>
        )}

        <h3 className="adm-form-section">{t("sections.publication")}</h3>
        <div className="form-grid">
          <ImageField
            currentUrl={item?.image_url}
            file={file}
            onFile={setFile}
            removed={removeImage}
            onRemovedChange={setRemoveImage}
          />
          <div className="field field--full">
            <Switch
              label={published ? t("publishedOn") : t("publishedOff")}
              checked={published}
              onChange={setPublished}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
