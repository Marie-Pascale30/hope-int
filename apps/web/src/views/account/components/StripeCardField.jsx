"use client";

import { useEffect, useMemo, useState } from "react";
import { CardCvcElement, CardExpiryElement, CardNumberElement } from "@stripe/react-stripe-js";
import { ChevronDown, Lock } from "lucide-react";
import { stripeErrorMessage } from "./donationData";

// Styles appliques dans les iframes Stripe (reprend les tokens du design system).
const ELEMENT_STYLE = {
  base: {
    color: "#1c2421",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontSize: "17px",
    fontSmoothing: "antialiased",
    "::placeholder": { color: "#9aa39f" },
  },
  invalid: { color: "#b42318", iconColor: "#b42318" },
};

// Pays proposes pour l'adresse de facturation (Cameroun et diaspora en tete).
const COUNTRY_CODES = [
  "CM", "FR", "BE", "CH", "CA", "US", "GB", "DE", "IT", "ES", "NL", "LU",
  "CI", "SN", "GA", "CG", "CD", "TD", "CF", "GQ", "NG", "BJ", "TG", "BF", "ML", "MA", "TN", "DZ",
];

function useCountryOptions() {
  return useMemo(() => {
    let names;
    try {
      names = new Intl.DisplayNames(["fr"], { type: "region" });
    } catch {
      names = null;
    }
    return COUNTRY_CODES.map((code) => ({ code, label: names?.of(code) || code }));
  }, []);
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
  const countries = useCountryOptions();
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
    setPartErrors((prev) => ({ ...prev, [key]: event.error ? stripeErrorMessage(event.error) : "" }));
  };

  const options = { style: ELEMENT_STYLE, disabled };
  const shownError = error || firstError;

  return (
    <div className="don-pay" role="group" aria-label="Carte bancaire">
      <PayBox label="Numéro de carte bancaire" invalid={Boolean(partErrors.number)}>
        <CardNumberElement options={{ ...options, showIcon: true, placeholder: "1234 1234 1234 1234" }} onChange={track("number")} />
      </PayBox>

      <div className="don-pay__row">
        <PayBox label="Date d’expiration" invalid={Boolean(partErrors.expiry)}>
          <CardExpiryElement options={{ ...options, placeholder: "MM / AA" }} onChange={track("expiry")} />
        </PayBox>
        <PayBox label="CVC" invalid={Boolean(partErrors.cvc)}>
          <CardCvcElement options={{ ...options, placeholder: "123" }} onChange={track("cvc")} />
        </PayBox>
      </div>

      <PayBox label="Pays ou région" htmlFor="don-pay-country" className="don-pay-box--select">
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

      <PayBox label="Nom complet du titulaire" htmlFor="don-pay-name">
        <input
          id="don-pay-name"
          className="don-pay-box__input"
          type="text"
          autoComplete="cc-name"
          placeholder="Comme indiqué sur la carte"
          value={holder}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
        />
      </PayBox>

      {shownError ? (
        <span className="field__error" role="alert">{shownError}</span>
      ) : (
        <span className="field__hint don-card-hint">
          <Lock size={13} aria-hidden="true" /> Vos données bancaires sont transmises directement à Stripe, jamais à nos serveurs.
        </span>
      )}
    </div>
  );
}
