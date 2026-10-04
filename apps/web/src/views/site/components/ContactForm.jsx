"use client";

// Formulaire de contact : POST /messages. Pre-rempli avec le nom et l'email du compte connecte.
import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Card, Input, Textarea, focusFirstInvalid } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { publicApi } from "../../../services";
import { errorMessage } from "../../../i18n/errors";

const MIN_MESSAGE = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form, t) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = t("errors.name");
  if (!EMAIL_RE.test(form.email.trim())) errors.email = t("errors.email");
  if (form.subject.trim().length < 3) errors.subject = t("errors.subject");
  if (form.content.trim().length < MIN_MESSAGE) errors.content = t("errors.content", { min: MIN_MESSAGE });
  return errors;
}

export default function ContactForm() {
  const t = useTranslations("site.contact.form");
  const tErrors = useTranslations("errors");
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", subject: "", content: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Nom et email : ceux du compte connecte tant que le visiteur n'a pas modifie le champ.
  const value = (key) => {
    if (key !== "name" && key !== "email") return form[key];
    return form[`${key}Touched`] ? form[key] : form[key] || user?.[key] || "";
  };

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value, [`${key}Touched`]: true }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setServerError("");
    const values = { name: value("name"), email: value("email"), subject: form.subject, content: form.content };
    const found = validate(values, t);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setSubmitting(true);
    try {
      await publicApi.sendMessage({
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        content: values.content.trim(),
      });
      setSent(true);
      setForm({ name: "", email: "", subject: "", content: "" });
    } catch (err) {
      setServerError(errorMessage(tErrors, err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Card className="pub-success" aria-live="polite">
        <span className="pub-success__icon"><CheckCircle2 size={30} aria-hidden="true" /></span>
        <h2>{t("sentTitle")}</h2>
        <p className="muted" style={{ margin: 0 }}>{t("sentText")}</p>
        <Button variant="secondary" onClick={() => setSent(false)}>{t("again")}</Button>
      </Card>
    );
  }

  return (
    <Card>
      <form className="pub-form" onSubmit={submit} noValidate>
        <div>
          <h2 className="pub-form__title">{t("title")}</h2>
          <p className="pub-form__intro">{t("required")}</p>
        </div>
        <div className="form-grid">
          <Input label={t("name")} required autoComplete="name" value={value("name")} onChange={update("name")} error={errors.name} />
          <Input label={t("email")} type="email" required autoComplete="email" value={value("email")} onChange={update("email")} error={errors.email} />
          <Input full label={t("subject")} required value={form.subject} onChange={update("subject")} error={errors.subject} />
          <Textarea
            full
            label={t("message")}
            required
            rows={7}
            value={form.content}
            onChange={update("content")}
            error={errors.content}
            hint={t("counter", { count: form.content.trim().length, min: MIN_MESSAGE })}
          />
        </div>
        {serverError && <Alert tone="danger" title={t("notSent")}>{serverError}</Alert>}
        <div className="form-actions">
          <p className="pub-form__legal">{t("legal")}</p>
          <Button type="submit" size="lg" icon={Send} loading={submitting}>{t("submit")}</Button>
        </div>
      </form>
    </Card>
  );
}
