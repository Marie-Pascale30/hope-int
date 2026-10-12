"use client";

// Don en hommage (facultatif) : en l'honneur de / a la memoire de, nom de la personne, email du
// proche a prevenir (e-carte sans le montant) et message court.
import { useTranslations } from "next-intl";
import { HeartHandshake } from "lucide-react";
import { Input, Switch, Textarea } from "../../../components/ui";
import { TRIBUTE_LIMITS } from "@hope/shared/fundraising";

export const EMPTY_TRIBUTE = { enabled: false, type: "honor", name: "", email: "", message: "" };

// Erreurs de saisie (cles fundraising.tribute.errors.*).
export function tributeErrors(tribute, emailPattern) {
  if (!tribute.enabled) return {};
  const errors = {};
  if (tribute.name.trim().length < 2) errors.tributeName = "name";
  if (tribute.email.trim() && !emailPattern.test(tribute.email.trim())) errors.tributeEmail = "email";
  if (tribute.message.length > TRIBUTE_LIMITS.message) errors.tributeMessage = "message";
  return errors;
}

// Champs envoyes a l'API (rien si l'option est desactivee).
export function tributePayload(tribute) {
  if (!tribute.enabled) return {};
  return {
    tributeType: tribute.type,
    tributeName: tribute.name.trim(),
    tributeEmail: tribute.email.trim() || undefined,
    tributeMessage: tribute.message.trim() || undefined,
  };
}

export default function TributeFields({ value, onChange, errors = {} }) {
  const t = useTranslations("fundraising.tribute");
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="fr-tribute">
      <Switch label={t("toggle")} checked={value.enabled} onChange={(enabled) => set({ enabled })} />
      {value.enabled && (
        <div className="fr-tribute__body">
          <div className="don-toggle" role="radiogroup" aria-label={t("typeLabel")}>
            {["honor", "memory"].map((type) => (
              <label key={type} className={`don-toggle__option${value.type === type ? " is-checked" : ""}`}>
                <input type="radio" name="don-hommage" value={type} checked={value.type === type} onChange={() => set({ type })} />
                <HeartHandshake size={18} aria-hidden="true" />
                {t(`types.${type}`)}
              </label>
            ))}
          </div>
          <div className="form-grid">
            <Input
              label={t("name")}
              required
              maxLength={TRIBUTE_LIMITS.name}
              value={value.name}
              onChange={(event) => set({ name: event.target.value })}
              error={errors.tributeName ? t(`errors.${errors.tributeName}`) : undefined}
            />
            <Input
              label={t("email")}
              type="email"
              inputMode="email"
              maxLength={TRIBUTE_LIMITS.email}
              value={value.email}
              onChange={(event) => set({ email: event.target.value })}
              hint={t("emailHint")}
              error={errors.tributeEmail ? t(`errors.${errors.tributeEmail}`) : undefined}
            />
          </div>
          <Textarea
            label={t("message")}
            rows={3}
            maxLength={TRIBUTE_LIMITS.message}
            value={value.message}
            onChange={(event) => set({ message: event.target.value })}
            hint={t("messageHint", { count: TRIBUTE_LIMITS.message - value.message.length })}
            error={errors.tributeMessage ? t(`errors.${errors.tributeMessage}`) : undefined}
          />
          <p className="muted fr-note">{t("receiptNote")}</p>
        </div>
      )}
    </div>
  );
}
