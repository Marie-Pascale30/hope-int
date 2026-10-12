"use client";

// Calculateur d'impact (accueil) : un curseur de montant -> une equivalence concrete.
// Reprend les paliers et les textes du parcours de don (donationData.js, account.donate.impact).
import { useId, useState } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui";
import { useFormat } from "@/src/i18n/format";
import { useLocalePath } from "@/src/i18n/navigation";
import { impactKey, toEur } from "@/src/views/account/components/donationData";

// Bornes du curseur par devise (le franc CFA a une parite fixe avec l'euro).
export const CALCULATOR_RANGES = {
  eur: { min: 5, max: 300, step: 5, initial: 25 },
  xaf: { min: 2500, max: 200000, step: 2500, initial: 15000 },
};

// Montant de microcredit cite dans les textes d'impact (FCFA), comme sur la page de don.
const LOAN_XAF = 30000;
const DEFAULT_XAF_PER_EUR = 655.957;

// Equivalence d'un montant : cle de texte (account.donate.impact.<cle>) et montant en euros.
export function impactFor(amount, currency, xafPerEur = DEFAULT_XAF_PER_EUR) {
  const eur = toEur(Number(amount) || 0, currency, xafPerEur);
  return { key: impactKey(eur), eur };
}

export default function ImpactCalculator({ xafPerEur = DEFAULT_XAF_PER_EUR }) {
  const t = useTranslations("transparency.calculator");
  const tImpact = useTranslations("account.donate.impact");
  const f = useFormat();
  const lp = useLocalePath();
  const id = useId();
  const [currency, setCurrency] = useState("eur");
  const [amount, setAmount] = useState(CALCULATOR_RANGES.eur.initial);
  const range = CALCULATOR_RANGES[currency];
  const { key, eur } = impactFor(amount, currency, xafPerEur);
  const formatted = f.money(amount, currency);

  const switchCurrency = (next) => {
    if (next === currency) return;
    setCurrency(next);
    setAmount(CALCULATOR_RANGES[next].initial);
  };

  return (
    <div className="impact-calc">
      <div className="impact-calc__controls">
        <div className="impact-calc__currency" role="group" aria-label={t("currency")}>
          {["eur", "xaf"].map((code) => (
            <button key={code} type="button" aria-pressed={currency === code} onClick={() => switchCurrency(code)}>
              {t(`currencies.${code}`)}
            </button>
          ))}
        </div>
        <label htmlFor={`${id}-amount`} className="impact-calc__label">{t("amountLabel")}</label>
        <output htmlFor={`${id}-amount`} className="impact-calc__amount" aria-live="off">{formatted}</output>
        <input
          id={`${id}-amount`}
          type="range"
          className="impact-calc__range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={amount}
          aria-valuetext={formatted}
          onChange={(event) => setAmount(Number(event.target.value))}
          style={{ "--fill": `${((amount - range.min) / (range.max - range.min)) * 100}%` }}
        />
        <div className="impact-calc__bounds" aria-hidden="true">
          <span>{f.money(range.min, currency)}</span>
          <span>{f.money(range.max, currency)}</span>
        </div>
      </div>
      <div className="impact-calc__result" aria-live="polite">
        <p className="impact-calc__lead">
          {t.rich("result", {
            amount: formatted,
            currency,
            equivalent: f.money(Math.round(eur), "eur"),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p className="impact-calc__impact">{tImpact(key, { loan: f.money(LOAN_XAF, "xaf") })}</p>
        <Button href={lp(`/don?montant=${amount}&devise=${currency}`)} variant="accent" icon={Heart}>
          {t("cta", { amount: formatted })}
        </Button>
        <p className="impact-calc__note">{t("note")}</p>
      </div>
    </div>
  );
}
