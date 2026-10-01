"use client";

import { useId, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Field } from "../../../components/ui";
import { passwordChecks } from "./authHelpers";

// Champ mot de passe avec bouton afficher / masquer.
export function PasswordInput({ label, hint, error, required, autoComplete = "current-password", ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <div className="acc-password">
        <input
          id={id}
          className="input"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
        <button
          type="button"
          className="acc-password__toggle"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
}

// Indicateur de robustesse : jauge + liste des regles.
export function PasswordStrength({ password }) {
  const checks = passwordChecks(password);
  const score = checks.filter((check) => check.ok).length;
  const level = !password ? "empty" : score === checks.length ? (password.length >= 12 ? "strong" : "good") : "weak";
  const labels = { empty: "", weak: "Trop faible", good: "Correct", strong: "Robuste" };
  return (
    <div className="acc-strength" aria-live="polite">
      <div className={`acc-strength__bar acc-strength__bar--${level}`} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {labels[level] && <span className="acc-strength__label">Robustesse : {labels[level]}</span>}
      <ul className="acc-strength__rules">
        {checks.map((check) => (
          <li key={check.key} className={check.ok ? "is-ok" : undefined}>
            {check.ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
            {check.label}
            <span className="visually-hidden">{check.ok ? " : respecté" : " : manquant"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
