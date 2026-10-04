"use client";

import { useEffect, useMemo, useState } from "react";
import { CardCvcElement, CardExpiryElement, CardNumberElement } from "@stripe/react-stripe-js";
import { ChevronDown, Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { stripeErrorMessage } from "./donationData";
import { readCssToken, useResolvedTheme } from "../../../utils/theme";

// Styles appliques dans les iframes Stripe : les iframes ne voient pas nos variables CSS,
// on leur passe donc les valeurs courantes des tokens (recalculees a chaque changement de theme).
function elementStyle() {
  const danger = readCssToken("--danger", "#b42318");
  return {
    base: {
      color: readCssToken("--ink", "#1c2421"),
      iconColor: readCssToken("--ink-2", "#4a5550"),
      fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSize: "17px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: readCssToken("--ink-3", "#5f6863") },
    },
    invalid: { color: danger, iconColor: danger },
  };
}

// Pays proposes pour l'adresse de facturation (Cameroun et diaspora en tete).
const COUNTRY_CODES = [
  "CM", "FR", "BE", "CH", "CA", "US", "GB", "DE", "IT", "ES", "NL", "LU",
  "CI", "SN", "GA", "CG", "CD", "TD", "CF", "GQ", "NG", "BJ", "TG", "BF", "ML", "MA", "TN", "DZ",
];

function useCountryOptions() {
  const locale = useLocale();
  return useMemo(() => {
    let names;
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      names = null;
    }
    return COUNTRY_CODES.map((code) => ({ code, label: names?.of(code) || code }));
  }, [locale]);
}

// Bloc de saisie facon Stripe Link : libelle au-dessus de la valeur, fond gris, bordure au focus.
function PayBox({ label, htmlFor, invalid, className = "", children }) {
  return (
    <div className={`don-pay-box${invalid ? " is-invalid" : ""} ${className}`}>
      {htmlFor ? (
        <label className="don-pay-box__label" htmlFor={htmlFor}>{label}</label>
      ) : (
        <span className="don-pay-box__label">{label}</span>
      )}
      {children}
    </div>
  );
}

// Saisie carte en champs separes (numero, expiration, CVC) + pays et nom du titulaire.
// onChange recoit { complete, error, billing: { name, country } }.
export default function StripeCardField({ onChange, error, disabled, defaultName = "" }) {
  const t = useTranslations("account.card");
  const tStripe = useTranslations("account.stripe");
  const countries = useCountryOptions();
  const theme = useResolvedTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const style = useMemo(() => elementStyle(), [theme]);
  const [parts, setParts] = useState({ number: false, expiry: false, cvc: false });
  const [partErrors, setPartErrors] = useState({ number: "", expiry: "", cvc: "" });
  const [country, setCountry] = useState("CM");
  const [name, setName] = useState(null); // null = nom du donateur

  const holder = name ?? defaultName;
  const complete = parts.number && parts.expiry && parts.cvc && holder.trim().length >= 2;
  const firstError = partErrors.number || partErrors.expiry || partErrors.cvc;

  useEffect(() => {
    onChange?.({ complete, error: firstError, billing: { name: holder.trim(), country } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, firstError, holder, country]);

  const track = (key) => (event) => {
    setParts((prev) => ({ ...prev, [key]: event.complete }));
    setPartErrors((prev) => ({ ...prev, [key]: event.error ? stripeErrorMessage(event.error, tStripe) : "" }));
  };

  const options = { style, disabled };
  const shownError = error || firstError;

  return (
    <div className="don-pay" role="group" aria-label={t("group")} tabIndex={-1} data-invalid={shownError ? "true" : undefined}>
      <PayBox label={t("number")} invalid={Boolean(partErrors.number)}>
        <CardNumberElement options={{ ...options, showIcon: true, placeholder: "1234 1234 1234 1234" }} onChange={track("number")} />
      </PayBox>

      <div className="don-pay__row">
        <PayBox label={t("expiry")} invalid={Boolean(partErrors.expiry)}>
          <CardExpiryElement options={{ ...options, placeholder: t("expiryPlaceholder") }} onChange={track("expiry")} />
        </PayBox>
        <PayBox label={t("cvc")} invalid={Boolean(partErrors.cvc)}>
          <CardCvcElement options={{ ...options, placeholder: "123" }} onChange={track("cvc")} />
        </PayBox>
      </div>

      <PayBox label={t("country")} htmlFor="don-pay-country" className="don-pay-box--select">
        <select
          id="don-pay-country"
          className="don-pay-box__input"
          value={country}
          disabled={disabled}
          onChange={(event) => setCountry(event.target.value)}
        >
          {countries.map((option) => (
            <option key={option.code} value={option.code}>{option.label}</option>
          ))}
        </select>
        <ChevronDown className="don-pay-box__chevron" size={20} aria-hidden="true" />
      </PayBox>

      <PayBox label={t("holder")} htmlFor="don-pay-name">
        <input
          id="don-pay-name"
          className="don-pay-box__input"
          type="text"
          autoComplete="cc-name"
          placeholder={t("holderPlaceholder")}
          value={holder}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
        />
      </PayBox>

      {shownError ? (
        <span className="field__error" role="alert">{shownError}</span>
      ) : (
        <span className="field__hint don-card-hint">
          <Lock size={13} aria-hidden="true" /> {t("secure")}
        </span>
      )}
    </div>
  );
}
