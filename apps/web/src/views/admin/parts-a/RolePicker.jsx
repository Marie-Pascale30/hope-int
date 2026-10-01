"use client";

import { ChoiceGroup } from "../../../components/ui";
import { canGrantRole } from "./roles";

// Selection des roles : admin exclusif, roles au-dessus des droits de l'utilisateur desactives.
export default function RolePicker({ user, matrix, value, onChange, label = "Rôles", hint, error }) {
  const entries = matrix?.roles || [];
  const options = entries.map((entry) => ({ value: entry.role, label: entry.label }));
  const disabledValues = entries.filter((entry) => !canGrantRole(user, entry)).map((entry) => entry.role);

  const handleChange = (next) => {
    const added = next.find((role) => !value.includes(role));
    if (added === "admin") onChange(["admin"]);
    else if (added) onChange(next.filter((role) => role !== "admin"));
    else onChange(next);
  };

  return (
    <ChoiceGroup
      label={label}
      hint={hint || "Le rôle Administrateur système ne se combine avec aucun autre. Les rôles grisés dépassent vos propres droits."}
      error={error}
      full
      options={options}
      value={value}
      onChange={handleChange}
      disabledValues={disabledValues}
    />
  );
}
