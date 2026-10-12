"use client";

// Champ de telephone camerounais (+237, 9 chiffres commencant par 6), qui accepte aussi les numeros
// internationaux (diaspora) sauf en mode Mobile Money. La saisie est libre ; elle est remise en
// forme a la sortie du champ ("+237 6 77 12 34 56") et l'operateur Mobile Money probable est
// annonce sous le champ. Validation : phoneError() de src/utils/phone.js (le parent affiche `error`,
// traduit par usePhoneErrorMessage()).
import { useTranslations } from "next-intl";
import { formatPhone, parsePhone } from "@/src/utils/phone";
import { Input } from "./Form";

export function PhoneField({ label, value, onChange, error, hint, mobileMoney = false, onBlur, ...props }) {
  const t = useTranslations("ui.phone");
  const parsed = parsePhone(value);
  const operatorHint = parsed.kind === "cm" && parsed.operator ? t(`operators.${parsed.operator}`) : null;
  const help = [operatorHint, hint ?? t(mobileMoney ? "hintMobileMoney" : "hint")].filter(Boolean).join(" · ");

  return (
    <Input
      label={label ?? t("label")}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      enterKeyHint="next"
      placeholder={t("placeholder")}
      maxLength={40}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => {
        const formatted = formatPhone(event.target.value);
        if (formatted !== event.target.value) onChange(formatted);
        onBlur?.(event);
      }}
      error={error}
      hint={help}
      {...props}
    />
  );
}

// Messages d'erreur traduits pour phoneError() : const phoneMessage = usePhoneErrorMessage();
export function usePhoneErrorMessage() {
  const t = useTranslations("ui.phone.errors");
  return (code) => (code ? t(code) : undefined);
}
