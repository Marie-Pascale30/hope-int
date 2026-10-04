"use client";

import "../../styles/account.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CardNumberElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { CalendarHeart, CreditCard, Heart, Lock, Mail, Receipt, RefreshCcw, Smartphone, Sprout } from "lucide-react";
import { Alert, Badge, Button, Input, focusFirstInvalid } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useMeta } from "../../hooks/useMeta";
import { pickPaymentMethod, usePaymentPreference } from "../../hooks/usePaymentPreference";
import { paymentApi, publicApi } from "../../services";
import { useFormat } from "../../i18n/format";
import { Link, useLocalePath } from "../../i18n/navigation";
import CampaignPicker from "./components/CampaignPicker";
import StripeCardField from "./components/StripeCardField";
import { EMAIL_PATTERN } from "./components/authHelpers";
import {
  DEFAULT_PRESET_INDEX,
  PRESET_AMOUNTS,
  convertAmount,
  impactKey,
  parseAmount,
  stripeErrorMessage,
  toEur,
} from "./components/donationData";
import { useErrorMessage } from "../../i18n/errors";
import { STRIPE_PUBLISHABLE_KEY, getStripe } from "./components/stripe";

// Nom affiche du prestataire Mobile Money actif (choisi par le serveur).
const MOBILE_PARTNERS = { notchpay: "Notch Pay", flutterwave: "Flutterwave" };

// Libelles : account.donate.methods.<value>.{title,detail}
const METHODS = [
  { value: "card", currency: "eur", icon: CreditCard },
  { value: "mobile_money", currency: "xaf", icon: Smartphone },
];

// Le recapitulatif est-il visible (ou deja depasse) ? Sert a masquer la barre de don mobile.
function useSummaryInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting || entry.boundingClientRect.top < 0);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

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
  const t = useTranslations("account.donate");
  const tStripe = useTranslations("account.stripe");
  const f = useFormat();
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const router = useRouter();
  const params = useSearchParams();
  const stripe = useStripe();
  const elements = useElements();
  const { user, isAuthenticated } = useAuth();
  const projects = useAsync(() => publicApi.listContent("projects"), []);

  const preference = usePaymentPreference();
  const [frequency, setFrequency] = useState("once");
  const [methodChoice, setMethodChoice] = useState(null); // null = moyen preselectionne automatiquement
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
  const [typing, setTyping] = useState(false); // champ texte actif : la barre mobile laisse la place au clavier
  const errorRef = useRef(null);
  const summaryRef = useRef(null);
  const summaryInView = useSummaryInView(summaryRef);

  const method = methodChoice ?? pickPaymentMethod({
    stored: preference.stored,
    centralAfrica: preference.centralAfrica,
    stripeReady,
    mobileReady: Boolean(meta.providers.mobileMoney),
    metaLoaded,
    frequency,
  });
  const rate = meta.xafPerEur;
  const currency = method === "card" ? "eur" : "xaf";
  const limits = meta.donationLimits[currency];
  const presets = PRESET_AMOUNTS[currency];
  const amount = presetIndex === null ? parseAmount(customAmount, currency) : presets[presetIndex];
  const amountValid = Number.isFinite(amount) && amount >= limits.min && amount <= limits.max;
  const amountLabel = amountValid ? f.money(amount, currency) : "—";
  const otherCurrency = currency === "eur" ? "xaf" : "eur";
  const equivalentLabel = amountValid ? f.money(convertAmount(amount, currency, otherCurrency, rate), otherCurrency) : "";

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
    errors.amount = t("errors.amount", { min: f.money(limits.min, currency), max: f.money(limits.max, currency) });
  }
  if (!isAuthenticated && donorName.length < 2) errors.name = t("errors.name", { min: 2 });
  if (!isAuthenticated && !EMAIL_PATTERN.test(donorEmail)) errors.email = t("errors.email");
  if (method === "mobile_money" && phoneValue.replace(/\D/g, "").length < 8) {
    errors.phone = t("errors.phone");
  }
  if (method === "card" && stripeReady && !card.complete) errors.card = card.error || t("errors.card");
  const shown = submitted ? errors : {};

  const changeFrequency = (value) => {
    setFrequency(value);
    if (value === "monthly" && method === "mobile_money") {
      changeMethod("card", false);
      setNotice(t("notices.monthlyCard"));
    } else {
      setNotice("");
    }
  };

  // `explicit` : choix du donateur, memorise pour ses prochaines visites.
  function changeMethod(value, resetNotice = true, explicit = false) {
    if (explicit) preference.remember(value);
    if (value === method) {
      setMethodChoice(value);
      return;
    }
    const nextCurrency = value === "card" ? "eur" : "xaf";
    // Un montant libre est converti dans la nouvelle devise, les paliers gardent leur rang.
    if (presetIndex === null && Number.isFinite(amount)) {
      setCustomAmount(String(convertAmount(amount, currency, nextCurrency, rate)));
    }
    setMethodChoice(value);
    if (value === "mobile_money" && frequency === "monthly") {
      setFrequency("once");
      setNotice(t("notices.mobileOnce"));
    } else if (resetNotice) {
      setNotice("");
    }
  }

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setSubmitError("");
    if (!providerReady) return;
    if (Object.keys(errors).length) {
      focusFirstInvalid(event.currentTarget);
      return;
    }

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
        showSubmitError(stripeErrorMessage(error, tStripe));
        return;
      }
      // Le statut est relu cote serveur ; la page de remerciement le reverifie de toute facon.
      await paymentApi.confirmReceipt(result.receiptToken).catch(() => null);
      router.push(lp(`/don/merci?ref=${result.receiptToken}`));
    } catch (err) {
      showSubmitError(errorText(err));
    }
  };

  // Une seule presentation de l'erreur : l'alerte du formulaire (role="alert"), qui recoit le focus.
  function showSubmitError(message) {
    setSubmitError(message);
    setSubmitting(false);
  }

  useEffect(() => {
    const node = errorRef.current;
    if (!submitError || !node) return;
    node.focus();
    if (typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [submitError]);

  const monthly = frequency === "monthly";
  const frequencyKey = monthly ? "monthly" : "once";
  const partnerName = MOBILE_PARTNERS[meta.providers.mobileMoneyProvider];
  // Libelle du bouton de validation, avec l'equivalent dans l'autre devise.
  const submitLabel = !metaLoaded
    ? t("submit.pending")
    : !providerReady
      ? t("submit.unavailable")
      : amountValid
        ? t("submit.donate", { amount: amountLabel, equivalent: equivalentLabel, frequency: frequencyKey })
        : t("submit.invalid");
  const submitDisabled = !providerReady || submitting || (method === "card" && !stripe);
  const isTextField = (target) => Boolean(target.matches?.("input:not([type=radio]):not([type=checkbox]), textarea, select, iframe"));

  return (
    <form
      className="don-layout"
      onSubmit={submit}
      noValidate
      onFocus={(event) => setTyping(isTextField(event.target))}
      onBlur={() => setTyping(false)}
    >
      <div className="don-main">
        {noProvider && (
          <Alert tone="warning" title={t("noProvider.title")}>
            {t.rich("noProvider.text", {
              email: meta.organization.email || t("noProvider.emailFallback"),
              strong: (chunks) => <strong>{chunks}</strong>,
              link: (chunks) => <Link href="/contact">{chunks}</Link>,
            })}
          </Alert>
        )}

        <Step number={1} title={t("steps.support.title")} description={t("steps.support.description")}>
          <div className="don-toggle" role="radiogroup" aria-label={t("frequency.label")}>
            {[
              { value: "once", label: t("frequency.once"), icon: Heart },
              { value: "monthly", label: t("frequency.monthly"), icon: CalendarHeart },
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

          <div className="don-methods" role="radiogroup" aria-label={t("methods.label")}>
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
                    onChange={() => changeMethod(option.value, true, true)}
                  />
                  <span className="don-method__icon"><option.icon size={22} aria-hidden="true" /></span>
                  <span className="don-method__body">
                    <span className="don-method__title">{t(`methods.${option.value}.title`)}</span>
                    <span className="don-method__detail">{t(`methods.${option.value}.detail`)}</span>
                    {option.value === "mobile_money" && <span className="don-method__detail">{t("methods.onceOnly")}</span>}
                  </span>
                  {metaLoaded && !available && <Badge tone="warning">{t("methods.soon")}</Badge>}
                </label>
              );
            })}
          </div>
          {notice && <Alert tone="info">{notice}</Alert>}
          {metaLoaded && !providerReady && !noProvider && (
            <Alert tone="warning" title={t(`methods.${method}.soonTitle`)}>
              {t(`methods.${method}.soonText`)}
            </Alert>
          )}
        </Step>

        <Step number={2} title={t("steps.amount.title")} description={t("steps.amount.description", { currency, frequency: frequencyKey })}>
          <div className="don-amounts" role="radiogroup" aria-label={t("amount.suggested")}>
            {presets.map((value, index) => {
              const checked = presetIndex === index;
              return (
                <label key={value} className={`don-amount${checked ? " is-checked" : ""}`}>
                  <input type="radio" name="don-montant" checked={checked} onChange={() => setPresetIndex(index)} />
                  <span className="don-amount__value">{f.money(value, currency)}</span>
                  <span className="don-amount__equiv">≈ {f.money(convertAmount(value, currency, otherCurrency, rate), otherCurrency)}</span>
                </label>
              );
            })}
          </div>
          <div className="don-custom">
            <Input
              label={t("amount.other")}
              inputMode={currency === "xaf" ? "numeric" : "decimal"}
              placeholder={t("amount.placeholder", { amount: f.number(currency === "eur" ? 40 : 15000) })}
              value={customAmount}
              onFocus={() => setPresetIndex(null)}
              onChange={(event) => {
                // Montant saisi dans la devise affichee : le moyen de paiement ne change plus tout seul.
                if (methodChoice === null) setMethodChoice(method);
                setPresetIndex(null);
                setCustomAmount(event.target.value);
              }}
              error={shown.amount || (presetIndex === null && customAmount && !amountValid ? errors.amount : undefined)}
              hint={t("amount.range", { min: f.money(limits.min, currency), max: f.money(limits.max, currency) })}
            />
            <span className="don-custom__suffix" aria-hidden="true">{currency === "eur" ? "€" : "FCFA"}</span>
          </div>
          {amountValid && (
            <div className="don-impact" aria-live="polite">
              <span className="don-impact__icon"><Sprout size={20} aria-hidden="true" /></span>
              <p>
                {t.rich("impact.sentence", {
                  amount: amountLabel,
                  frequency: frequencyKey,
                  currency,
                  equivalent: f.money(Math.round(toEur(amount, currency, rate))),
                  impact: t(`impact.${impactKey(toEur(amount, currency, rate))}`, { loan: f.money(30000, "xaf") }),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
            </div>
          )}
        </Step>

        <Step number={3} title={t("steps.project.title")} description={t("steps.project.description")}>
          {requestedClosed && (
            <Alert tone="info">{t("requestedClosed")}</Alert>
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

        <Step number={4} title={t("steps.donor.title")} description={t("steps.donor.description")}>
          {isAuthenticated ? (
            <div className="don-identity">
              <span>
                {t.rich("donor.as", { name: user.name, email: user.email, strong: (chunks) => <strong>{chunks}</strong> })}
              </span>
              <span className="muted">{t("donor.inAccount")}</span>
            </div>
          ) : (
            <>
              <div className="form-grid">
                <Input
                  label={t("donor.name")}
                  autoComplete="name"
                  required
                  value={donor.name}
                  onChange={(event) => setDonor((prev) => ({ ...prev, name: event.target.value }))}
                  error={shown.name}
                />
                <Input
                  label={t("donor.email")}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={donor.email}
                  onChange={(event) => setDonor((prev) => ({ ...prev, email: event.target.value }))}
                  error={shown.email}
                  hint={t("donor.emailHint")}
                />
              </div>
              <p className="don-login-hint">
                {t.rich("donor.loginHint", {
                  link: (chunks) => (
                    <Link href={`/connexion?next=${encodeURIComponent(lp(projectId ? `/don?projet=${projectId}` : "/don"))}`}>
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </>
          )}
          {method === "mobile_money" && (
            <Input
              label={t("donor.phone")}
              type="tel"
              autoComplete="tel"
              placeholder={t("donor.phonePlaceholder")}
              required
              value={phoneValue}
              onChange={(event) => setPhone(event.target.value)}
              error={shown.phone}
              hint={t("donor.phoneHint")}
            />
          )}
        </Step>

        <Step number={5} title={t("steps.payment.title")}>
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
              {partnerName ? t("payment.redirectPartner", { partner: partnerName }) : t("payment.redirect")}
            </p>
          )}
          {!providerReady && (
            <p className="don-step__desc">
              {metaLoaded ? t("payment.notOpen") : t("payment.checking")}
            </p>
          )}
          {submitError && (
            <div ref={errorRef} tabIndex={-1} className="don-error">
              <Alert tone="danger" title={t("payment.failedTitle")}>{submitError}</Alert>
            </div>
          )}
        </Step>

        <p className="don-receipt-note">
          <Receipt size={18} aria-hidden="true" />
          <span>{t("receiptNote")}</span>
        </p>
      </div>

      <aside className="don-summary" aria-label={t("summary.label")}>
        <div className="don-summary__card" ref={summaryRef}>
          <span className="eyebrow">{t("summary.eyebrow")}</span>
          <p className="don-summary__amount">
            {amountLabel}
            {monthly && <small>{t("perMonthShort")}</small>}
          </p>
          {amountValid && monthly && (
            <p className="don-summary__hint">{t("summary.yearly", { amount: f.money(amount * 12, currency) })}</p>
          )}
          <dl className="don-summary__list">
            <div>
              <dt>{t("summary.frequency")}</dt>
              <dd>{t(`summary.frequencyValue.${frequencyKey}`)}</dd>
            </div>
            <div>
              <dt>{t("summary.project")}</dt>
              <dd>{project ? project.title : t("general")}</dd>
            </div>
            <div>
              <dt>{t("summary.method")}</dt>
              <dd>{t(`summary.methodValue.${method}`)}</dd>
            </div>
            <div>
              <dt>{t("summary.donor")}</dt>
              <dd>{donorName || t("summary.donorEmpty")}</dd>
            </div>
          </dl>
          {submitted && Object.keys(errors).length > 0 && providerReady && (
            <p className="field__error" role="alert">{t("summary.checkFields")}</p>
          )}
          <Button
            type="submit"
            variant="accent"
            size="lg"
            block
            icon={Heart}
            loading={submitting}
            disabled={submitDisabled}
          >
            {submitLabel}
          </Button>
          <ul className="don-reassure">
            <li>
              <Lock size={16} aria-hidden="true" />{" "}
              {method === "card" || partnerName
                ? t("reassure.secureVia", { partner: method === "card" ? "Stripe" : partnerName })
                : t("reassure.secureMobile")}
            </li>
            <li><Mail size={16} aria-hidden="true" /> {t("reassure.receipt")}</li>
            <li><RefreshCcw size={16} aria-hidden="true" /> {t("reassure.stop")}</li>
          </ul>
        </div>
      </aside>

      {/* Barre de don mobile (< 768 px) : raccourci visuel du recapitulatif, masque aux technologies
          d'assistance et hors de l'ordre de tabulation (le bouton du recapitulatif reste la reference). */}
      <div className={`don-sticky${summaryInView || typing ? " is-hidden" : ""}`} aria-hidden="true">
        <div className="don-sticky__amount">
          <span className="don-sticky__label">{t("sticky.label")}</span>
          <strong>
            {amountLabel}
            {monthly && <small>{t("perMonthShort")}</small>}
          </strong>
          {equivalentLabel && <span className="don-sticky__equiv">≈ {equivalentLabel}</span>}
        </div>
        <Button type="submit" variant="accent" icon={Heart} tabIndex={-1} loading={submitting} disabled={submitDisabled}>
          {t("sticky.submit")}
        </Button>
      </div>
    </form>
  );
}

export default function DonateView() {
  const t = useTranslations("account.donate.hero");
  const locale = useLocale();
  const { meta, loaded } = useMeta();
  const stripeReady = Boolean(meta.providers.stripe && STRIPE_PUBLISHABLE_KEY);
  // Langue de Stripe (champs de carte, messages d'erreur) : celle de la page.
  const stripePromise = stripeReady ? getStripe(locale) : null;

  return (
    <>
      <section className="don-hero">
        <div className="container">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p className="lead">{t("lead")}</p>
        </div>
      </section>
      <div className="container don-wrap">
        <Elements key={locale} stripe={stripePromise} options={{ locale }}>
          <DonateForm meta={meta} metaLoaded={loaded} stripeReady={stripeReady} />
        </Elements>
      </div>
    </>
  );
}
