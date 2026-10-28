// Adhesion : role des membres, prerequis, droit d'adhesion et bareme des cotisations annuelles
// (guide de bienvenue de l'association). Partage par les pages "Qui sommes-nous" et "Nous rejoindre".
import "../../../styles/about.css";
import { ArrowRight, BadgeCheck, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { hl } from "../../../components/motion/hl";
import { Button, Card } from "../../../components/ui";
import { useFormat } from "../../../i18n/format";
import { XAF_PER_EUR } from "@hope/shared/constants";
import { useLocalePath } from "../../../i18n/navigation";

// Montants en francs CFA. max absent : palier ouvert ("et plus") ; min = max : montant fixe.
export const MEMBERSHIP = {
  entryFee: 100000,
  tiers: [
    { key: "bronze", min: 50000, max: 50000 },
    { key: "silver", min: 51000, max: 100000 },
    { key: "vermeil", min: 101000, max: 150000 },
    { key: "gold", min: 151000, max: 200000 },
    { key: "diamond", min: 201000 },
  ],
};

// id : ancre de la section ; cta : lien vers le formulaire de candidature (/rejoindre) ;
// alt : fond alterne de la section.
export default function MembershipFees({ id = "adhesion", cta = false, alt = false }) {
  const t = useTranslations("site.membership");
  const f = useFormat();
  const lp = useLocalePath();
  const money = (value) => f.money(value, "xaf");
  // Equivalent en euros a parite fixe (1 EUR = 655,957 FCFA), arrondi a l'euro pres.
  const euros = (value) => f.money(Math.round(value / XAF_PER_EUR), "eur");
  const range = ({ min, max }, format) => {
    if (!max) return t("atLeast", { min: format(min) });
    if (min === max) return format(min);
    return t("range", { min: format(min), max: format(max) });
  };

  return (
    <section id={id} className={`section${alt ? " section--alt" : ""}`} aria-labelledby={`${id}-title`}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h2 id={`${id}-title`}>{t.rich("title", { hl })}</h2>
          <p>{t("text")}</p>
        </div>

        <div className="membership">
          <Card className="membership__roles">
            <h3>{t("roleTitle")}</h3>
            <p className="muted">{t("roleIntro")}</p>
            <ul className="about-checklist">
              {t.raw("roles").map((role) => (
                <li key={role}><Check aria-hidden="true" /> <span>{role}</span></li>
              ))}
            </ul>
          </Card>

          <div className="membership__fees">
            <Card className="membership__entry">
              <p className="membership__prerequisite">
                <BadgeCheck aria-hidden="true" />
                <span><strong>{t("prerequisiteTitle")}</strong>{t("prerequisite")}</span>
              </p>
              <div className="membership__entry-fee">
                <span>{t("entryFee")}</span>
                <strong>{money(MEMBERSHIP.entryFee)}</strong>
                <em className="membership__eur">{t("eurEquivalent", { amount: euros(MEMBERSHIP.entryFee) })}</em>
                <small>{t("entryFeeHint")}</small>
              </div>
            </Card>

            <div className="membership__table-wrap">
              <table className="membership__table">
                <caption>{t("tableCaption")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("level")}</th>
                    <th scope="col">{t("amount")}</th>
                    <th scope="col">{t("amountEur")}</th>
                  </tr>
                </thead>
                <tbody>
                  {MEMBERSHIP.tiers.map((tier) => (
                    <tr key={tier.key}>
                      <th scope="row">
                        <span className={`membership__badge membership__badge--${tier.key}`} aria-hidden="true" />
                        {t(`levels.${tier.key}`)}
                      </th>
                      <td>{range(tier, money)}</td>
                      <td className="membership__eur-cell">{range(tier, euros)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="membership__rate">{t("rateNote")}</p>

            {cta && (
              <Button href={lp("/rejoindre")} variant="accent" iconRight={ArrowRight}>{t("cta")}</Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
