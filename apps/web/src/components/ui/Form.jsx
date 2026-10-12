"use client";

// Champs de formulaire accessibles (libelle, aide, erreur relies par aria-describedby).
import { useId } from "react";
import { cx } from "./utils";

// Identifiants de l'aide et de l'erreur d'un champ (pour aria-describedby).
export function fieldDescriptionIds(id, { hint, error } = {}) {
  if (!id) return undefined;
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

const joinIds = (...ids) => ids.filter(Boolean).join(" ") || undefined;

// htmlFor : id du controle ; sert aussi de base aux id de l'aide et de l'erreur.
export function Field({ label, hint, error, required, full, htmlFor, labelId, children, className }) {
  const describedBy = htmlFor || labelId;
  return (
    <div className={cx("field", full && "field--full", className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor} id={labelId}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" id={describedBy ? `${describedBy}-error` : undefined} role="alert">{error}</span>
      ) : (
        hint && <span className="field__hint" id={describedBy ? `${describedBy}-hint` : undefined}>{hint}</span>
      )}
    </div>
  );
}

function useFieldId(id) {
  const generated = useId();
  return id || generated;
}

// Attributs d'accessibilite communs aux controles (aria-invalid, aria-describedby).
function controlA11y(inputId, { hint, error, describedBy }) {
  return {
    "aria-invalid": error ? "true" : undefined,
    "aria-describedby": joinIds(fieldDescriptionIds(inputId, { hint, error }), describedBy),
  };
}

export function Input({ label, hint, error, full, required, id, className, "aria-describedby": describedBy, ...props }) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} full={full} htmlFor={inputId}>
      <input id={inputId} className={cx("input", className)} required={required} {...controlA11y(inputId, { hint, error, describedBy })} {...props} />
    </Field>
  );
}

export function Textarea({ label, hint, error, full, required, id, className, "aria-describedby": describedBy, ...props }) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} full={full} htmlFor={inputId}>
      <textarea id={inputId} className={cx("textarea", className)} required={required} {...controlA11y(inputId, { hint, error, describedBy })} {...props} />
    </Field>
  );
}

// options : [{ value, label }] ; placeholder ajoute une option vide
export function Select({ label, hint, error, full, required, id, options = [], placeholder, className, "aria-describedby": describedBy, ...props }) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} full={full} htmlFor={inputId}>
      <select id={inputId} className={cx("select", className)} required={required} {...controlA11y(inputId, { hint, error, describedBy })} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

// Choix multiples sous forme de puces cliquables (remplace les <select multiple>).
export function ChoiceGroup({ label, hint, error, full, options = [], value = [], onChange, multiple = true, name, disabledValues = [] }) {
  const groupName = useFieldId(name);
  const labelId = `${groupName}-label`;
  const toggle = (optionValue) => {
    if (!multiple) return onChange(optionValue);
    onChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  };
  return (
    <Field label={label} hint={hint} error={error} full={full} labelId={label ? labelId : undefined}>
      <div
        className="choice-group"
        role="group"
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={fieldDescriptionIds(labelId, { hint, error })}
        data-invalid={error ? "true" : undefined}
      >
        {options.map((option) => {
          const checked = multiple ? value.includes(option.value) : value === option.value;
          return (
            <label key={option.value} className="choice">
              <input
                type={multiple ? "checkbox" : "radio"}
                name={groupName}
                checked={checked}
                disabled={disabledValues.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </Field>
  );
}

export function Switch({ label, checked, onChange, ...props }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} {...props} />
      {label}
    </label>
  );
}
