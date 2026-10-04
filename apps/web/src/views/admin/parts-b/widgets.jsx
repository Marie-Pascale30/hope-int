"use client";

// Petits composants communs aux ecrans dons / finance / contenus / evenements / rapport.
import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { ImagePlus, Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Field } from "../../../components/ui";
import { useFormat } from "../../../i18n/format";
import { resolveImage } from "../../../utils/format";
import { showError } from "../../../utils/alerts";
import { formatEur, formatMonthKey, percent } from "./finance";

const PLACEHOLDER = "/images/placeholder.svg";

// Graphique mensuel charge sans rendu serveur (Chart.js a besoin du navigateur).
export const MonthlyChart = dynamic(() => import("./MonthlyChart"), {
  ssr: false,
  loading: () => <div className="chart-box skeleton" aria-hidden="true" />,
});

// Vignette d'image (chemins /uploads ou /images), avec illustration de repli.
export function Thumb({ src, alt = "", className = "adm-thumb" }) {
  const [failed, setFailed] = useState(false);
  const url = !failed && resolveImage(src) ? resolveImage(src) : PLACEHOLDER;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

// Selecteur compact (annee, periode...) avec libelle visible.
export function InlineSelect({ label, value, onChange, options }) {
  const id = useId();
  return (
    <div className="adm-inline-select">
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
export function ShareTable({ rows, labelHeader, valueHeader, caption }) {
  const t = useTranslations("adminOps.tables");
  const f = useFormat();
  const total = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  return (
    <div className="table-wrap">
      <table className="table adm-share">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">{labelHeader || t("label")}</th>
            <th scope="col" className="num">{t("donations")}</th>
            <th scope="col" className="num">{valueHeader || t("amountEur")}</th>
            <th scope="col">{t("share")}</th>
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
                <td className="num">{f.number(row.count)}</td>
                <td className="num adm-nowrap">{row.display || formatEur(f, row.value)}</td>
                <td>
                  <div className="adm-share__bar">
                    <div className="adm-share__track" aria-hidden="true">
                      <div className="adm-share__fill" style={{ width: `${share}%` }} />
                    </div>
                    <span className="adm-share__pct">{f.number(share / 100, { style: "percent", maximumFractionDigits: 1 })}</span>
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
  const t = useTranslations("adminOps.tables");
  const f = useFormat();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{t("month")}</th>
            <th scope="col" className="num">{t("donations")}</th>
            <th scope="col" className="num">{t("amountEur")}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((row) => (
            <tr key={row.month}>
              <td>{f.key(row.month, { month: "long", year: "numeric" })}</td>
              <td className="num">{f.number(row.count)}</td>
              <td className="num adm-nowrap">{formatEur(f, row.amountEur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Formats acceptes par l'API (verification de la signature binaire du fichier) : JPG, PNG, WebP, GIF.
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const IMAGE_ACCEPT = [...IMAGE_TYPES, ".jpg", ".jpeg", ".png", ".webp", ".gif"].join(",");
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Choix d'une image avec apercu. `currentUrl` : image deja enregistree ;
// `removed` : l'utilisateur a demande de la retirer (envoye comme remove_image: "1").
export function ImageField({ currentUrl, file, onFile, removed, onRemovedChange }) {
  const t = useTranslations("adminOps.image");
  const inputId = useId();
  const [preview, setPreview] = useState(null);
  const shown = (file && preview) || (!removed && resolveImage(currentUrl));

  const onChange = (event) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!IMAGE_TYPES.includes(selected.type)) {
      showError(t("formatTitle"), t("formatText"));
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      showError(t("sizeTitle"), t("sizeText", { max: 5 }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(selected);
    onFile(selected);
    onRemovedChange(false);
  };

  return (
    <Field label={t("label")} hint={t("hint", { max: 5 })} full>
      <div className="adm-image-field">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={t("preview")} className="adm-image-field__preview" />
        ) : (
          <div className="adm-image-field__empty">
            {removed ? t("removedNote") : t("none")}
          </div>
        )}
        <div className="adm-image-field__controls">
          <div className="adm-file">
            <span className="btn btn--secondary btn--sm" aria-hidden="true">
              <ImagePlus aria-hidden="true" /> {shown ? t("replace") : t("choose")}
            </span>
            <input
              id={inputId}
              type="file"
              accept={IMAGE_ACCEPT}
              onChange={onChange}
              aria-label={shown ? t("replace") : t("choose")}
            />
          </div>
          {file && (
            <Button size="sm" variant="ghost" icon={Undo2} onClick={() => onFile(null)}>
              {t("undoNew")}
            </Button>
          )}
          {!file && currentUrl && !removed && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onRemovedChange(true)}>
              {t("remove")}
            </Button>
          )}
          {!file && removed && (
            <Button size="sm" variant="ghost" icon={Undo2} onClick={() => onRemovedChange(false)}>
              {t("keep")}
            </Button>
          )}
        </div>
      </div>
    </Field>
  );
}
