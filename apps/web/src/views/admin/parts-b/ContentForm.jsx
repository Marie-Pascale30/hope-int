"use client";

// Formulaire (en modale) de creation / modification d'un projet, d'une actualite ou d'un temoignage.
import { useState } from "react";
import { Save } from "lucide-react";
import { Button, Input, Modal, Select, Switch, Textarea } from "../../../components/ui";
import { useMeta, regionOptions } from "../../../hooks/useMeta";
import { adminApi } from "../../../services";
import { getErrorMessage } from "../../../services/api";
import { showError, toast } from "../../../utils/alerts";
import { ImageField } from "./widgets";

const FORM_ID = "admb-content-form";

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

const STATUS_OPTIONS = [
  { value: "planifie", label: "Planifié (bientôt)" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminé" },
];

function SummaryCounter({ value }) {
  return <span className="admb-counter">{value.length} / 500</span>;
}

export default function ContentForm({ type, item, labels, projects = [], onClose, onSaved }) {
  const { meta } = useMeta();
  const [values, setValues] = useState(() => toFormValues(type, item));
  const [published, setPublished] = useState(item ? Boolean(item.published) : false);
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setValues((prev) => ({ ...prev, [key]: event.target.value }));
  const projectOptions = projects.map((project) => ({ value: String(project.id), label: project.title }));
  const datesInvalid = type === "projects" && values.start_date && values.end_date && values.end_date < values.start_date;

  const submit = async (event) => {
    event.preventDefault();
    if (datesInvalid) return;
    setSaving(true);
    const payload = { ...values, published };
    if (file) payload.image = file;
    else if (removeImage) payload.remove_image = "1";
    try {
      const saved = item
        ? await adminApi.updateContent(type, item.id, payload)
        : await adminApi.createContent(type, payload);
      toast(item ? "Modifications enregistrées" : labels.created);
      onSaved(saved, Boolean(item));
    } catch (err) {
      showError("Enregistrement impossible", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      large
      title={item ? `Modifier ${labels.the}` : labels.create}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" form={FORM_ID} icon={Save} loading={saving}>
            {item ? "Enregistrer" : "Créer"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <h3 className="admb-form-section">Contenu</h3>
        <div className="form-grid">
          {type === "testimonials" ? (
            <>
              <Input label="Auteur" required maxLength={150} value={values.author} onChange={set("author")} placeholder="Ex. Estelle K." />
              <Input
                label="Fonction ou lieu"
                maxLength={150}
                value={values.role_label}
                onChange={set("role_label")}
                placeholder="Ex. Promotion 2025, Douala"
              />
              <Textarea
                label="Témoignage"
                required
                full
                rows={6}
                value={values.content}
                onChange={set("content")}
                hint="Les mots de la personne, tels qu'elle les a partagés (avec son accord)."
              />
            </>
          ) : (
            <>
              <Input label="Titre" required full maxLength={255} value={values.title} onChange={set("title")} />
              <Textarea
                label={<>Résumé <SummaryCounter value={values.summary} /></>}
                full
                rows={2}
                maxLength={500}
                value={values.summary}
                onChange={set("summary")}
                hint="Une ou deux phrases affichées sur les cartes et en tête de page."
              />
              {type === "projects" ? (
                <Textarea label="Description" required full rows={8} value={values.description} onChange={set("description")} />
              ) : (
                <Textarea label="Contenu" required full rows={10} value={values.content} onChange={set("content")} />
              )}
            </>
          )}
          {type !== "projects" && (
            <Select
              label="Projet lié"
              placeholder="Aucun projet"
              options={projectOptions}
              value={values.project_id}
              onChange={set("project_id")}
            />
          )}
        </div>

        {type === "projects" && (
          <>
            <h3 className="admb-form-section">Cadre du projet</h3>
            <div className="form-grid">
              <Select label="Statut" options={STATUS_OPTIONS} value={values.status} onChange={set("status")} />
              <Select label="Région" placeholder="Non précisée" options={regionOptions(meta)} value={values.region} onChange={set("region")} />
              <Input label="Date de début" type="date" value={values.start_date} onChange={set("start_date")} />
              <Input
                label="Date de fin"
                type="date"
                value={values.end_date}
                onChange={set("end_date")}
                min={values.start_date || undefined}
                error={datesInvalid ? "La date de fin doit suivre la date de début" : undefined}
              />
              <Input label="Budget total (EUR)" type="number" min={0} step="0.01" value={values.budget} onChange={set("budget")} />
              <Input
                label="Objectif de collecte (EUR)"
                type="number"
                min={0}
                step="1"
                value={values.goal_amount}
                onChange={set("goal_amount")}
                hint="Laissez vide si le projet n'a pas de campagne de collecte en cours."
              />
            </div>

            <h3 className="admb-form-section">Indicateurs d&apos;impact</h3>
            <div className="form-grid">
              <Input label="Bénéficiaires" type="number" min={0} step="1" value={values.beneficiaries} onChange={set("beneficiaries")} />
              <Input label="Personnes formées" type="number" min={0} step="1" value={values.trainees} onChange={set("trainees")} />
              <Input label="Crédits accordés" type="number" min={0} step="1" value={values.credits_granted} onChange={set("credits_granted")} />
            </div>
          </>
        )}

        <h3 className="admb-form-section">Image et publication</h3>
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
              label={published ? "Publié : visible sur le site" : "Brouillon : non visible sur le site"}
              checked={published}
              onChange={setPublished}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
