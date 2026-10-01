"use client";

// Petits composants communs aux ecrans dons / finance / contenus / evenements / rapport.
import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { ImagePlus, Trash2, Undo2 } from "lucide-react";
import { Button, Field } from "../../../components/ui";
import { formatMonth, formatNumber, resolveImage } from "../../../utils/format";
import { showError } from "../../../utils/alerts";
import { formatEur, percent } from "./finance";

const PLACEHOLDER = "/images/placeholder.svg";

// Graphique mensuel charge sans rendu serveur (Chart.js a besoin du navigateur).
export const MonthlyChart = dynamic(() => import("./MonthlyChart"), {
  ssr: false,
  loading: () => <div className="chart-box skeleton" aria-hidden="true" />,
});

// Vignette d'image (chemins /uploads ou /images), avec illustration de repli.
export function Thumb({ src, alt = "", className = "admb-thumb" }) {
  const [failed, setFailed] = useState(false);
  const url = !failed && resolveImage(src) ? resolveImage(src) : PLACEHOLDER;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

// Selecteur compact (annee, periode...) avec libelle visible.
export function InlineSelect({ label, value, onChange, options }) {
  const id = useId();
  return (
    <div className="admb-inline-select">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

// Table de repartition avec barre de part (montants en EUR).
// rows : [{ key, label, sub?, count, value (EUR), display? }]
export function ShareTable({ rows, labelHeader = "Libellé", valueHeader = "Montant (EUR)", caption }) {
  const total = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  return (
    <div className="table-wrap">
      <table className="table admb-share">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">{labelHeader}</th>
            <th scope="col" className="num">Dons</th>
            <th scope="col" className="num">{valueHeader}</th>
            <th scope="col">Part</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const share = percent(row.value, total);
            return (
              <tr key={row.key}>
                <td>
                  <div className="cell-main">
                    <strong>{row.label}</strong>
                    {row.sub && <span>{row.sub}</span>}
                  </div>
                </td>
                <td className="num">{formatNumber(row.count)}</td>
                <td className="num admb-nowrap">{row.display || formatEur(row.value)}</td>
                <td>
                  <div className="admb-share__bar">
                    <div className="admb-share__track" aria-hidden="true">
                      <div className="admb-share__fill" style={{ width: `${share}%` }} />
                    </div>
                    <span className="admb-share__pct">{formatNumber(share, { maximumFractionDigits: 1 })} %</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Valeurs mensuelles en clair (alternative lisible au graphique).
export function MonthTable({ months }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Mois</th>
            <th scope="col" className="num">Dons</th>
            <th scope="col" className="num">Montant (EUR)</th>
          </tr>
        </thead>
        <tbody>
          {months.map((row) => (
            <tr key={row.month}>
              <td>{formatMonth(row.month)}</td>
              <td className="num">{formatNumber(row.count)}</td>
              <td className="num admb-nowrap">{formatEur(row.amountEur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Choix d'une image avec apercu. `currentUrl` : image deja enregistree ;
// `removed` : l'utilisateur a demande de la retirer (envoye comme remove_image: "1").
export function ImageField({ currentUrl, file, onFile, removed, onRemovedChange }) {
  const inputId = useId();
  const [preview, setPreview] = useState(null);
  const shown = (file && preview) || (!removed && resolveImage(currentUrl));

  const onChange = (event) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!IMAGE_TYPES.includes(selected.type)) {
      showError("Format non accepté", "Choisissez une image JPG, PNG, WebP ou GIF.");
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      showError("Image trop lourde", "La taille maximale est de 5 Mo. Réduisez l'image puis réessayez.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(selected);
    onFile(selected);
    onRemovedChange(false);
  };

  return (
    <Field label="Image" hint="JPG, PNG, WebP ou GIF — 5 Mo maximum. Format paysage conseillé." full>
      <div className="admb-image-field">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Aperçu de l'image" className="admb-image-field__preview" />
        ) : (
          <div className="admb-image-field__empty">
            {removed ? "Image retirée à l'enregistrement" : "Aucune image : une illustration par défaut sera affichée"}
          </div>
        )}
        <div className="admb-image-field__controls">
          <div className="admb-file">
            <span className="btn btn--secondary btn--sm" aria-hidden="true">
              <ImagePlus aria-hidden="true" /> {shown ? "Remplacer l'image" : "Choisir une image"}
            </span>
            <input
              id={inputId}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              onChange={onChange}
              aria-label={shown ? "Remplacer l'image" : "Choisir une image"}
            />
          </div>
          {file && (
            <Button size="sm" variant="ghost" icon={Undo2} onClick={() => onFile(null)}>
              Annuler la nouvelle image
            </Button>
          )}
          {!file && currentUrl && !removed && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onRemovedChange(true)}>
              Retirer l&apos;image
            </Button>
          )}
          {!file && removed && (
            <Button size="sm" variant="ghost" icon={Undo2} onClick={() => onRemovedChange(false)}>
              Conserver l&apos;image actuelle
            </Button>
          )}
        </div>
      </div>
    </Field>
  );
}
