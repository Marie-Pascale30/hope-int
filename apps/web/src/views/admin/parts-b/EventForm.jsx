"use client";

// Formulaire (en modale) de creation / modification d'un evenement.
import { useState } from "react";
import { Save } from "lucide-react";
import { Alert, Button, Input, Modal, Select, Switch, Textarea } from "../../../components/ui";
import { regionOptions, useMeta } from "../../../hooks/useMeta";
import { adminApi } from "../../../services";
import { getErrorMessage } from "../../../services/api";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "../../../utils/format";
import { showError, toast } from "../../../utils/alerts";
import { ImageField } from "./widgets";

const FORM_ID = "admb-event-form";

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
  const { meta } = useMeta();
  const [values, setValues] = useState(() => initialValues(event));
  const [published, setPublished] = useState(event ? Boolean(event.published) : true);
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const set = (key) => (e) => setValues((prev) => ({ ...prev, [key]: e.target.value }));
  const registered = event?.registered_count || 0;
  const endInvalid = values.start_at && values.end_at && values.end_at < values.start_at;
  const capacityInvalid = values.capacity !== "" && Number(values.capacity) < Math.max(1, registered);

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
      toast(event ? "Événement mis à jour" : "Événement créé");
      onSaved(saved, Boolean(event));
    } catch (err) {
      const message = getErrorMessage(err);
      setServerError(message);
      showError("Enregistrement impossible", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      large
      title={event ? "Modifier l'événement" : "Nouvel événement"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" form={FORM_ID} icon={Save} loading={saving}>{event ? "Enregistrer" : "Créer"}</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        {serverError && <Alert tone="danger" title="Le serveur a refusé l'enregistrement">{serverError}</Alert>}
        <h3 className="admb-form-section">Présentation</h3>
        <div className="form-grid">
          <Input label="Titre" required full minLength={3} maxLength={255} value={values.title} onChange={set("title")} />
          <Textarea
            label="Description"
            required
            full
            rows={5}
            minLength={10}
            value={values.description}
            onChange={set("description")}
            hint="Programme, public attendu, ce qu'il faut apporter… (10 caractères minimum)"
          />
          <Select
            label="Projet lié"
            placeholder="Aucun projet"
            options={projects.map((project) => ({ value: String(project.id), label: project.title }))}
            value={values.project_id}
            onChange={set("project_id")}
          />
        </div>

        <h3 className="admb-form-section">Lieu et horaires</h3>
        <div className="form-grid">
          <Input label="Lieu" required minLength={2} maxLength={255} value={values.location} onChange={set("location")} placeholder="Ex. Centre HOPE, Douala" />
          <Select label="Région" placeholder="Non précisée" options={regionOptions(meta)} value={values.region} onChange={set("region")} />
          <Input label="Début" type="datetime-local" required value={values.start_at} onChange={set("start_at")} />
          <Input
            label="Fin"
            type="datetime-local"
            value={values.end_at}
            onChange={set("end_at")}
            min={values.start_at || undefined}
            error={endInvalid ? "La fin doit être après le début" : undefined}
          />
          <Input
            label="Capacité"
            type="number"
            min={Math.max(1, registered)}
            step="1"
            value={values.capacity}
            onChange={set("capacity")}
            error={capacityInvalid ? `Au moins ${Math.max(1, registered)} place(s) : ${registered} personne(s) déjà inscrite(s)` : undefined}
            hint={registered ? `Laisser vide = places illimitées. ${registered} inscrit(s) actuellement.` : "Laisser vide = places illimitées."}
          />
        </div>

        <h3 className="admb-form-section">Image et publication</h3>
        <div className="form-grid">
          <ImageField currentUrl={event?.image_url} file={file} onFile={setFile} removed={removeImage} onRemovedChange={setRemoveImage} />
          <div className="field field--full">
            <Switch
              label={published ? "Publié : visible et ouvert aux inscriptions" : "Brouillon : non visible sur le site"}
              checked={published}
              onChange={setPublished}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
