"use client";

import { useTranslations } from "next-intl";
import { ChoiceGroup } from "../../../components/ui";
import { useLabels } from "../../../utils/labels";
import { canGrantRole } from "./roles";

// Selection des roles : admin exclusif, roles au-dessus des droits de l'utilisateur desactives.
export default function RolePicker({ user, matrix, value, onChange, label, hint, error }) {
  const t = useTranslations("admin.rolePicker");
  const labels = useLabels();
  const entries = matrix?.roles || [];
  const options = entries.map((entry) => ({ value: entry.role, label: labels.role(entry.role) }));
  const disabledValues = entries.filter((entry) => !canGrantRole(user, entry)).map((entry) => entry.role);

  const handleChange = (next) => {
    const added = next.find((role) => !value.includes(role));
    if (added === "admin") onChange(["admin"]);
    else if (added) onChange(next.filter((role) => role !== "admin"));
    else onChange(next);
  };

  return (
    <ChoiceGroup
      label={label || t("label")}
      hint={hint || t("hint")}
      error={error}
      full
      options={options}
      value={value}
      onChange={handleChange}
      disabledValues={disabledValues}
    />
  );
}
