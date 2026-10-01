"use client";

import "../../styles/account.css";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CardNumberElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { CalendarHeart, CreditCard, Heart, Lock, Mail, RefreshCcw, Smartphone, Sprout } from "lucide-react";
import { Alert, Badge, Button, Input } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useMeta } from "../../hooks/useMeta";
import { paymentApi, publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { showError } from "../../utils/alerts";
import { formatMoney } from "../../utils/format";
import CampaignPicker from "./components/CampaignPicker";
import StripeCardField from "./components/StripeCardField";
import { EMAIL_PATTERN } from "./components/authHelpers";
import {
  DEFAULT_PRESET_INDEX,
  PRESET_AMOUNTS,
  convertAmount,
  impactFor,
  parseAmount,
  stripeErrorMessage,
  toEur,
} from "./components/donationData";
import { STRIPE_PUBLISHABLE_KEY, getStripe } from "./components/stripe";

// Nom affiche du prestataire Mobile Money actif (choisi par le serveur).
const MOBILE_PARTNERS = { notchpay: "Notch Pay", flutterwave: "Flutterwave" };

const METHODS = [
  {
    value: "card",
    currency: "eur",
    icon: CreditCard,
    title: "Carte bancaire",
    detail: "En euros · Visa, Mastercard, CB",
  },
  {
    value: "mobile_money",
    currency: "xaf",
    icon: Smartphone,
    title: "Mobile Money",
    detail: "En FCFA · Orange Money, MTN MoMo",
  },
];

function Step({ number, title, description, children }) {
  return (
    <section className="don-step" aria-labelledby={`don-step-${number}`}>
      <header className="don-step__head">
        <span className="don-step__num" aria-hidden="true">{number}</span>
        <div>
          <h2 id={`don-step-${number}`} className="don-step__title">{title}</h2>
          {description && <p className="don-step__desc">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function DonateForm({ meta, metaLoaded, stripeReady }) {
  const router = useRouter();
  const params = useSearchParams();
  const stripe = useStripe();
  const elements = useElements();
  const { user, isAuthenticated } = useAuth();
  const projects = useAsync(() => publicApi.listContent("projects"), []);

  const [frequency, setFrequency] = useState("once");
  const [method, setMethod] = useState("card");
  const [presetIndex, setPresetIndex] = useState(DEFAULT_PRESET_INDEX); // null = montant libre
  const [customAmount, setCustomAmount] = useState("");
  const [projectChoice, setProjectChoice] = useState(null); // null = selection issue de l'URL
  const [donor, setDonor] = useState({ name: "", email: "" });
  const [phone, setPhone] = useState(null); // null = telephone du compte
  const [card, setCard] = useState({ complete: false, error: "", billing: { name: "", country: "CM" } });
  const [notice, setNotice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const rate = meta.xafPerEur;
  const currency = method === "card" ? "eur" : "xaf";
  const limits = meta.donationLimits[currency];
  const presets = PRESET_AMOUNTS[currency];
  const amount = presetIndex === null ? parseAmount(customAmount, currency) : presets[presetIndex];
  const amountValid = Number.isFinite(amount) && amount >= limits.min && amount <= limits.max;
  const amountLabel = amountValid ? formatMoney(amount, currency) : "—";

  // Campagnes ouvertes aux dons ; pre-selection via ?projet=<id>.
  const campaigns = useMemo(() => (projects.data || []).filter((project) => project.status !== "termine"), [projects.data]);
  const requested = params.get("projet");
  const requestedOpen = Boolean(requested) && campaigns.some((project) => String(project.id) === requested);
  const projectId = projectChoice ?? (requestedOpen ? requested : "");
  const project = campaigns.find((item) => String(item.id) === projectId) || null;
  const requestedClosed = Boolean(requested) && projectChoice === null && Boolean(projects.data) && !requestedOpen;

  const providerReady = method === "card" ? stripeReady : Boolean(meta.providers.mobileMoney);
  const noProvider = metaLoaded && !stripeReady && !meta.providers.mobileMoney;
  const phoneValue = phone ?? user?.phone ?? "";
  const donorName = isAuthenticated ? user.name : donor.name.trim();
  const donorEmail = isAuthenticated ? user.email : donor.email.trim();

  const errors = {};
  if (!amountValid) {
    errors.amount = `Indiquez un montant entre ${formatMoney(limits.min, currency)} et ${formatMoney(limits.max, currency)}.`;
  }
  if (!isAuthenticated && donorName.length < 2) errors.name = "Indiquez votre nom (2 caractères minimum)";
  if (!isAuthenticated && !EMAIL_PATTERN.test(donorEmail)) errors.email = "Adresse email invalide";
  if (method === "mobile_money" && phoneValue.replace(/\D/g, "").length < 8) {
    errors.phone = "Indiquez le numéro Mobile Money à débiter";
  }
  if (method === "card" && stripeReady && !card.complete) errors.card = card.error || "Complétez les informations de votre carte";
  const shown = submitted ? errors : {};

  const changeFrequency = (value) => {
    setFrequency(value);
    if (value === "monthly" && method === "mobile_money") {
      changeMethod("card", false);
      setNotice("Le don mensuel se fait par carte bancaire : nous avons sélectionné ce moyen de paiement.");
    } else {
      setNotice("");
    }
  };

  function changeMethod(value, resetNotice = true) {
    if (value === method) return;
    const nextCurrency = value === "card" ? "eur" : "xaf";
    // Un montant libre est converti dans la nouvelle devise, les paliers gardent leur rang.
    if (presetIndex === null && Number.isFinite(amount)) {
      setCustomAmount(String(convertAmount(amount, currency, nextCurrency, rate)));
    }
    setMethod(value);
    if (value === "mobile_money" && frequency === "monthly") {
      setFrequency("once");
      setNotice("Mobile Money permet uniquement les dons ponctuels : votre don est passé en ponctuel.");
    } else if (resetNotice) {
      setNotice("");
    }
  }

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setSubmitError("");
    if (!providerReady || Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const result = await paymentApi.createDonation({
        amount,
        provider: method === "card" ? "stripe" : "mobile_money",
        frequency,
        projectId: projectId ? Number(projectId) : undefined,
        donorName: isAuthenticated ? undefined : donorName,
        donorEmail: isAuthenticated ? undefined : donorEmail,
        phone: method === "mobile_money" ? phoneValue.trim() : undefined,
      });

      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }

      const { error } = await stripe.confirmCardPayment(result.clientSecret, {
        payment_method: {
          card: elements.getElement(CardNumberElement),
          billing_details: {
            name: card.billing.name || donorName,
            email: donorEmail,
            address: { country: card.billing.country },
          },
        },
      });
      if (error) {
        setSubmitError(stripeErrorMessage(error));
        setSubmitting(false);
        return;
      }
      // Le statut est relu cote serveur ; la page de remerciement le reverifie de toute facon.
      await paymentApi.confirmReceipt(result.receiptToken).catch(() => null);
      router.push(`/don/merci?ref=${result.receiptToken}`);
    } catch (err) {
      const message = getErrorMessage(err);
      setSubmitError(message);
      showError("Le don n’a pas pu être lancé", message);
      setSubmitting(false);
    }
  };

  const perMonth = frequency === "monthly" ? " par mois" : "";
  const submitLabel = !metaLoaded
    ? "Chargement…"
    : providerReady
      ? `Donner ${amountLabel}${perMonth}`
      : "Paiement bientôt disponible";

  return (
    <form className="don-layout" onSubmit={submit} noValidate>
      <div className="don-main">
        {noProvider && (
          <Alert tone="warning" title="Le paiement en ligne arrive très bientôt">
            Nos moyens de paiement sécurisés sont en cours d’activation. En attendant, vous pouvez donner par virement ou
            Mobile Money en nous écrivant à <strong>{meta.organization.email || "notre adresse de contact"}</strong> ou via
            la <Link href="/contact">page Contact</Link> : nous vous répondons sous 48 heures.
          </Alert>
        )}

        <Step number={1} title="Votre soutien" description="Un don mensuel nous permet de planifier l’accompagnement des familles sur la durée.">
          <div className="don-toggle" role="radiogroup" aria-label="Fréquence du don">
            {[
              { value: "once", label: "Une fois", icon: Heart },
              { value: "monthly", label: "Chaque mois", icon: CalendarHeart },
            ].map((option) => (
              <label key={option.value} className={`don-toggle__option${frequency === option.value ? " is-checked" : ""}`}>
                <input
                  type="radio"
                  name="don-frequence"
                  value={option.value}
                  checked={frequency === option.value}
                  onChange={() => changeFrequency(option.value)}
                />
                <option.icon size={18} aria-hidden="true" />
                {option.label}
              </label>
            ))}
          </div>

          <div className="don-methods" role="radiogroup" aria-label="Moyen de paiement">
            {METHODS.map((option) => {
              const available = option.value === "card" ? stripeReady : Boolean(meta.providers.mobileMoney);
              const checked = method === option.value;
              return (
                <label key={option.value} className={`don-method${checked ? " is-checked" : ""}`}>
                  <input
                    type="radio"
                    name="don-moyen"
                    value={option.value}
                    checked={checked}
                    onChange={() => changeMethod(option.value)}
                  />
                  <span className="don-method__icon"><option.icon size={22} aria-hidden="true" /></span>
                  <span className="don-method__body">
                    <span className="don-method__title">{option.title}</span>
                    <span className="don-method__detail">{option.detail}</span>
                    {option.value === "mobile_money" && <span className="don-method__detail">Don ponctuel uniquement</span>}
                  </span>
                  {metaLoaded && !available && <Badge tone="warning">Bientôt disponible</Badge>}
                </label>
              );
            })}
          </div>
          {notice && <Alert tone="info">{notice}</Alert>}
          {metaLoaded && !providerReady && !noProvider && (
            <Alert tone="warning" title={`${method === "card" ? "Carte bancaire" : "Mobile Money"} : bientôt disponible`}>
              Ce moyen de paiement est en cours d’activation.{" "}
              {method === "card" ? "Vous pouvez dès aujourd’hui donner par Mobile Money." : "Vous pouvez dès aujourd’hui donner par carte bancaire."}
            </Alert>
          )}
        </Step>

        <Step number={2} title="Montant" description={`Montants en ${currency === "eur" ? "euros" : "francs CFA"}${perMonth ? ", prélevés chaque mois" : ""}.`}>
          <div className="don-amounts" role="radiogroup" aria-label="Montant suggéré">
            {presets.map((value, index) => {
              const checked = presetIndex === index;
              const other = currency === "eur" ? "xaf" : "eur";
              return (
                <label key={value} className={`don-amount${checked ? " is-checked" : ""}`}>
                  <input type="radio" name="don-montant" checked={checked} onChange={() => setPresetIndex(index)} />
                  <span className="don-amount__value">{formatMoney(value, currency)}</span>
                  <span className="don-amount__equiv">≈ {formatMoney(convertAmount(value, currency, other, rate), other)}</span>
                </label>
              );
            })}
          </div>
          <div className="don-custom">
            <Input
              label="Autre montant"
              inputMode={currency === "xaf" ? "numeric" : "decimal"}
              placeholder={currency === "eur" ? "Ex. : 40" : "Ex. : 15 000"}
              value={customAmount}
              onFocus={() => setPresetIndex(null)}
              onChange={(event) => {
                setPresetIndex(null);
                setCustomAmount(event.target.value);
              }}
              error={shown.amount || (presetIndex === null && customAmount && !amountValid ? errors.amount : undefined)}
              hint={`De ${formatMoney(limits.min, currency)} à ${formatMoney(limits.max, currency)}`}
            />
            <span className="don-custom__suffix" aria-hidden="true">{currency === "eur" ? "€" : "FCFA"}</span>
          </div>
          {amountValid && (
            <div className="don-impact" aria-live="polite">
              <span className="don-impact__icon"><Sprout size={20} aria-hidden="true" /></span>
              <p>
                <strong>
                  {amountLabel}
                  {perMonth}
                </strong>
                {currency === "xaf" && ` (≈ ${formatMoney(Math.round(toEur(amount, currency, rate)))})`}, c’est par exemple{" "}
                {impactFor(toEur(amount, currency, rate))}
              </p>
            </div>
          )}
        </Step>

        <Step number={3} title="Affectation" description="Choisissez une campagne ou laissez-nous orienter votre don.">
          {requestedClosed && (
            <Alert tone="info">
              Le projet demandé ne reçoit plus de dons ou n’est plus en ligne : vous pouvez soutenir une autre campagne ci-dessous.
            </Alert>
          )}
          <CampaignPicker
            campaigns={campaigns}
            loading={projects.loading}
            error={projects.error}
            onRetry={projects.reload}
            value={projectId}
            onChange={setProjectChoice}
          />
        </Step>

        <Step number={4} title="Vos coordonnées" description="Elles servent à établir votre reçu et à vous l’envoyer par email.">
          {isAuthenticated ? (
            <div className="don-identity">
              <span>
                Vous donnez en tant que <strong>{user.name}</strong> ({user.email}).
              </span>
              <span className="muted">Ce don apparaîtra dans votre espace, avec son reçu.</span>
            </div>
          ) : (
            <>
              <div className="form-grid">
                <Input
                  label="Nom complet"
                  autoComplete="name"
                  required
                  value={donor.name}
                  onChange={(event) => setDonor((prev) => ({ ...prev, name: event.target.value }))}
                  error={shown.name}
                />
                <Input
                  label="Adresse email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={donor.email}
                  onChange={(event) => setDonor((prev) => ({ ...prev, email: event.target.value }))}
                  error={shown.email}
                  hint="Votre reçu y sera envoyé."
                />
              </div>
              <p className="don-login-hint">
                Déjà un compte ?{" "}
                <Link href={`/connexion?next=${encodeURIComponent(projectId ? `/don?projet=${projectId}` : "/don")}`}>
                  Connectez-vous
                </Link>{" "}
                pour retrouver tous vos dons et reçus dans votre espace.
              </p>
            </>
          )}
          {method === "mobile_money" && (
            <Input
              label="Numéro Mobile Money"
              type="tel"
              autoComplete="tel"
              placeholder="Ex. : 6 77 12 34 56"
              required
              value={phoneValue}
              onChange={(event) => setPhone(event.target.value)}
              error={shown.phone}
              hint="Numéro Orange Money ou MTN MoMo qui validera le paiement."
            />
          )}
        </Step>

        <Step number={5} title="Paiement">
          {method === "card" && stripeReady && (
            <StripeCardField
              disabled={submitting}
              error={shown.card || card.error || undefined}
              defaultName={donorName}
              onChange={(state) => setCard(state)}
            />
          )}
          {method === "mobile_money" && providerReady && (
            <p className="don-step__desc">
              Après validation, vous serez redirigé vers la page sécurisée de notre partenaire {MOBILE_PARTNERS[meta.providers.mobileMoneyProvider] || "de paiement"} pour confirmer le
              paiement sur votre téléphone.
            </p>
          )}
          {!providerReady && (
            <p className="don-step__desc">
              {metaLoaded
                ? "Ce moyen de paiement n’est pas encore ouvert. Merci de votre patience : il sera activé très prochainement."
                : "Vérification des moyens de paiement disponibles…"}
            </p>
          )}
          {submitError && <Alert tone="danger" title="Le paiement n’a pas abouti">{submitError}</Alert>}
        </Step>
      </div>

      <aside className="don-summary" aria-label="Récapitulatif de votre don">
        <div className="don-summary__card">
          <span className="eyebrow">Récapitulatif</span>
          <p className="don-summary__amount">
            {amountLabel}
            {perMonth && <small>/ mois</small>}
          </p>
          {amountValid && frequency === "monthly" && (
            <p className="don-summary__hint">Soit {formatMoney(amount * 12, currency)} sur un an, arrêtable à tout moment.</p>
          )}
          <dl className="don-summary__list">
            <div>
              <dt>Fréquence</dt>
              <dd>{frequency === "monthly" ? "Mensuel" : "Ponctuel"}</dd>
            </div>
            <div>
              <dt>Affectation</dt>
              <dd>{project ? project.title : "Là où c’est le plus utile"}</dd>
            </div>
            <div>
              <dt>Moyen</dt>
              <dd>{method === "card" ? "Carte bancaire (EUR)" : "Mobile Money (FCFA)"}</dd>
            </div>
            <div>
              <dt>Donateur</dt>
              <dd>{donorName || "À compléter"}</dd>
            </div>
          </dl>
          {submitted && Object.keys(errors).length > 0 && providerReady && (
            <p className="field__error" role="alert">Vérifiez les champs signalés avant de valider votre don.</p>
          )}
          <Button
            type="submit"
            variant="accent"
            size="lg"
            block
            icon={Heart}
            loading={submitting}
            disabled={!providerReady || submitting || (method === "card" && !stripe)}
          >
            {submitLabel}
          </Button>
          <ul className="don-reassure">
            <li><Lock size={16} aria-hidden="true" /> Paiement sécurisé et chiffré via {method === "card" ? "Stripe" : MOBILE_PARTNERS[meta.providers.mobileMoneyProvider] || "notre partenaire Mobile Money"}</li>
            <li><Mail size={16} aria-hidden="true" /> Reçu envoyé par email et téléchargeable en PDF</li>
            <li><RefreshCcw size={16} aria-hidden="true" /> Don mensuel arrêtable à tout moment depuis votre espace</li>
          </ul>
        </div>
      </aside>
    </form>
  );
}

export default function DonateView() {
  const { meta, loaded } = useMeta();
  const stripeReady = Boolean(meta.providers.stripe && STRIPE_PUBLISHABLE_KEY);
  const stripePromise = stripeReady ? getStripe() : null;

  return (
    <>
      <section className="don-hero">
        <div className="container">
          <span className="eyebrow">Faire un don</span>
          <h1>Donnez aux familles les moyens de réussir</h1>
          <p className="lead">
            Chaque don finance des microcrédits solidaires, des formations et un accompagnement de proximité au Cameroun.
            Vous choisissez où va votre générosité, nous vous montrons ce qu’elle permet.
          </p>
        </div>
      </section>
      <div className="container don-wrap">
        <Elements stripe={stripePromise} options={{ locale: "fr" }}>
          <DonateForm meta={meta} metaLoaded={loaded} stripeReady={stripeReady} />
        </Elements>
      </div>
    </>
  );
}
