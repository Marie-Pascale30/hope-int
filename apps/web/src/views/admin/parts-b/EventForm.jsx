"use client";

// Formulaire (en modale) de creation / modification d'un evenement.
import { useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Input, Modal, Select, Switch, Textarea } from "../../../components/ui";
import { regionOptions, useMeta } from "../../../hooks/useMeta";
import { adminApi } from "../../../services";
import { useErrorMessage } from "../../../i18n/errors";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "../../../utils/format";
import { useAlerts } from "../../../utils/alerts";
import { ImageField } from "./widgets";

const FORM_ID = "adm-event-form";
const DESCRIPTION_MIN = 10;

function initialValues(event) {
  return {
    title: event?.title || "",
    description: event?.description || "",
    location: event?.location || "",
    region: event?.region || "",
    start_at: toDateTimeLocalValue(event?.start_at),
    end_at: toDateTimeLocalValue(event?.end_at),
    capacity: event?.capacity ? String(event.capacity) : "",
    project_id: event?.project_id ? String(event.project_id) : "",
  };
}

export default function EventForm({ event, projects = [], onClose, onSaved }) {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.eventForm");
  const { showError, toast } = useAlerts();
  const { meta } = useMeta();
  const [values, setValues] = useState(() => initialValues(event));
  const [published, setPublished] = useState(event ? Boolean(event.published) : true);
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const set = (key) => (e) => setValues((prev) => ({ ...prev, [key]: e.target.value }));
  const registered = Number(event?.registered_count) || 0;
  const minCapacity = Math.max(1, registered);
  const endInvalid = values.start_at && values.end_at && values.end_at < values.start_at;
  const capacityInvalid = values.capacity !== "" && Number(values.capacity) < minCapacity;

  const submit = async (e) => {
    e.preventDefault();
    if (endInvalid || capacityInvalid) return;
    setSaving(true);
    setServerError("");
    const payload = {
      ...values,
      start_at: fromDateTimeLocalValue(values.start_at),
      end_at: fromDateTimeLocalValue(values.end_at),
      published,
    };
    if (file) payload.image = file;
    else if (removeImage) payload.remove_image = "1";
    try {
      const saved = event ? await adminApi.updateEvent(event.id, payload) : await adminApi.createEvent(payload);
      toast(event ? t("updated") : t("created"));
      onSaved(saved, Boolean(event));
    } catch (err) {
      // Message deja traduit par l'API.
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
      title={event ? t("editTitle") : t("createTitle")}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" form={FORM_ID} icon={Save} loading={saving}>{event ? t("save") : t("create")}</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        {serverError && <Alert tone="danger" title={t("serverRefused")}>{serverError}</Alert>}
        <h3 className="adm-form-section">{t("sections.presentation")}</h3>
        <div className="form-grid">
          <Input label={t("fields.title")} required full minLength={3} maxLength={255} value={values.title} onChange={set("title")} />
          <Textarea
            label={t("fields.description")}
            required
            full
            rows={5}
            minLength={DESCRIPTION_MIN}
            value={values.description}
            onChange={set("description")}
            hint={t("hints.description", { min: DESCRIPTION_MIN })}
          />
          <Select
            label={t("fields.project")}
            placeholder={t("placeholders.noProject")}
            options={projects.map((project) => ({ value: String(project.id), label: project.title }))}
            value={values.project_id}
            onChange={set("project_id")}
          />
        </div>

        <h3 className="adm-form-section">{t("sections.place")}</h3>
        <div className="form-grid">
          <Input
            label={t("fields.location")}
            required
            minLength={2}
            maxLength={255}
            value={values.location}
            onChange={set("location")}
            placeholder={t("placeholders.location")}
          />
          <Select
            label={t("fields.region")}
            placeholder={t("placeholders.noRegion")}
            options={regionOptions(meta)}
            value={values.region}
            onChange={set("region")}
          />
          <Input label={t("fields.start")} type="datetime-local" required value={values.start_at} onChange={set("start_at")} />
          <Input
            label={t("fields.end")}
            type="datetime-local"
            value={values.end_at}
            onChange={set("end_at")}
            min={values.start_at || undefined}
            error={endInvalid ? t("errors.end") : undefined}
          />
          <Input
            label={t("fields.capacity")}
            type="number"
            min={minCapacity}
            step="1"
            value={values.capacity}
            onChange={set("capacity")}
            error={capacityInvalid ? t("errors.capacity", { min: minCapacity, count: registered }) : undefined}
            hint={registered ? t("hints.capacityRegistered", { count: registered }) : t("hints.capacity")}
          />
        </div>

        <h3 className="adm-form-section">{t("sections.publication")}</h3>
        <div className="form-grid">
          <ImageField currentUrl={event?.image_url} file={file} onFile={setFile} removed={removeImage} onRemovedChange={setRemoveImage} />
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
