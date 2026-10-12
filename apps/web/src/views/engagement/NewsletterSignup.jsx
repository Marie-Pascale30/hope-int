"use client";

// Inscription a la lettre d'information (pied de page) : double opt-in, l'API envoie un email de
// confirmation ; la reponse est identique que l'adresse soit deja inscrite ou non.
import { useId, useState } from "react";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { preferencesApi } from "../../services/engagement";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterSignup() {
  const t = useTranslations("engagement.footer");
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | done | invalid | error

  const submit = async (event) => {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setState("invalid");
      return;
    }
    setState("loading");
    try {
      await preferencesApi.subscribeNewsletter(value);
      setState("done");
      setEmail("");
    } catch {
      setState("error");
    }
  };

  const message = { done: t("success"), invalid: t("invalid"), error: t("error") }[state];

  return (
    <form className="eng-newsletter" onSubmit={submit} noValidate>
      <h2 className="site-footer__title">{t("newsletterTitle")}</h2>
      <p>{t("newsletterText")}</p>
      <div className="eng-newsletter__row">
        <label htmlFor={`${id}-email`} className="visually-hidden">{t("emailLabel")}</label>
        <input
          id={`${id}-email`}
          type="email"
          className="input eng-newsletter__input"
          autoComplete="email"
          inputMode="email"
          placeholder={t("emailLabel")}
          value={email}
          aria-invalid={state === "invalid" ? "true" : undefined}
          aria-describedby={`${id}-status ${id}-note`}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="btn btn--accent" disabled={state === "loading"}>
          <Send size={16} aria-hidden="true" />
          {t("submit")}
        </button>
      </div>
      <p id={`${id}-status`} className={`eng-newsletter__status eng-newsletter__status--${state}`} role="status" aria-live="polite">
        {message || ""}
      </p>
      <p id={`${id}-note`} className="eng-newsletter__note">{t("consentNote")}</p>
    </form>
  );
}
