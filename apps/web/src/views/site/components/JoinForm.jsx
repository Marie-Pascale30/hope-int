"use client";

// Formulaire de candidature : POST /applications { name, email, phone?, region?, motivation, interests? }.
// Les poles d'interet sont des preferences : l'equipe choisit ensuite le role.
import { useRef, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Card, ChoiceGroup, Input, PhoneField, Select, Textarea, focusFirstInvalid, usePhoneErrorMessage } from "@/src/components/ui";
import { formatPhone, phoneError } from "@/src/utils/phone";
import { useAuth } from "@/src/context/AuthContext";
import { useLocalePath } from "@/src/i18n/navigation";
import { publicApi } from "@/src/services";
import { errorMessage } from "@/src/i18n/errors";

const MIN_MOTIVATION = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY = { name: "", email: "", phone: "", region: "", motivation: "" };

function validate(form, t, phoneMessage) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = t("errors.name");
  if (!EMAIL_RE.test(form.email.trim())) errors.email = t("errors.email");
  const phone = phoneMessage(phoneError(form.phone));
  if (phone) errors.phone = phone;
  if (form.motivation.trim().length < MIN_MOTIVATION) errors.motivation = t("errors.motivation", { min: MIN_MOTIVATION });
  return errors;
}

function Confirmation({ email, onReset }) {
  const t = useTranslations("site.join.confirmation");
  const lp = useLocalePath();
  return (
    <Card className="pub-success" aria-live="polite">
      <span className="pub-success__icon"><CheckCircle2 size={30} aria-hidden="true" /></span>
      <h2>{t("title")}</h2>
      <p className="muted" style={{ margin: 0 }}>{t("intro")}</p>
      <ol className="pub-steps">
        <li><strong>{t("s1.title")}</strong><span>{t("s1.text")}</span></li>
        <li><strong>{t("s2.title")}</strong><span>{t("s2.text", { email })}</span></li>
        <li><strong>{t("s3.title")}</strong><span>{t("s3.text")}</span></li>
      </ol>
      <div className="row">
        <Button href={lp("/")}>{t("home")}</Button>
        <Button variant="secondary" onClick={onReset}>{t("again")}</Button>
      </div>
    </Card>
  );
}

export default function JoinForm({ regions = [], interestAreas = [] }) {
  const t = useTranslations("site.join.form");
  const tAreas = useTranslations("site.join.interests");
  const tErrors = useTranslations("errors");
  const phoneMessage = usePhoneErrorMessage();
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [interests, setInterests] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const alertRef = useRef(null);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };
  const update = (key) => (event) => setField(key, event.target.value);

  // Libelles traduits par valeur ; repli sur le libelle (francais) fourni par l'API.
  const interestOptions = interestAreas.map((area) => ({
    value: area.value,
    label: tAreas.has(area.value) ? tAreas(area.value) : area.label,
  }));
  const regionOptions = regions.map((region) => ({ value: region, label: region }));
  const motivationLength = form.motivation.trim().length;

  const submit = async (event) => {
    event.preventDefault();
    setServerError("");
    const found = validate(form, t, phoneMessage);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setSubmitting(true);
    try {
      await publicApi.sendApplication({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: formatPhone(form.phone) || undefined,
        region: form.region || undefined,
        motivation: form.motivation.trim(),
        interests: interests.length ? interests : undefined,
      });
      setSentTo(form.email.trim());
      setForm(EMPTY);
      setInterests([]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = errorMessage(tErrors, err);
      setServerError(err?.response?.status === 409 ? `${message} ${t("duplicate")}` : message);
      requestAnimationFrame(() => alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) return <Confirmation email={sentTo} onReset={() => setSentTo("")} />;

  return (
    <Card>
      <form className="pub-form" onSubmit={submit} noValidate>
        <div>
          <h3 className="pub-form__title">{t("title")}</h3>
          <p className="pub-form__intro">{t("required")}</p>
        </div>
        <div className="form-grid">
          <Input label={t("name")} required autoComplete="name" enterKeyHint="next" value={form.name} onChange={update("name")} error={errors.name} />
          <Input label={t("email")} type="email" inputMode="email" required autoComplete="email" enterKeyHint="next" value={form.email} onChange={update("email")} error={errors.email} />
          <PhoneField label={t("phone")} value={form.phone} onChange={(value) => setField("phone", value)} error={errors.phone} />
          <Select label={t("region")} options={regionOptions} placeholder={t("regionPlaceholder")} value={form.region} onChange={update("region")} />
          {interestOptions.length > 0 && (
            <ChoiceGroup
              full
              label={t("interests")}
              hint={t("interestsHint")}
              options={interestOptions}
              value={interests}
              onChange={setInterests}
            />
          )}
          <Textarea
            full
            label={t("motivation")}
            required
            rows={6}
            placeholder={t("motivationPlaceholder")}
            value={form.motivation}
            onChange={update("motivation")}
            error={errors.motivation}
            hint={
              <span className={`pub-counter${motivationLength >= MIN_MOTIVATION ? " pub-counter--ok" : ""}`}>
                {t("counter", { count: motivationLength, min: MIN_MOTIVATION })}
              </span>
            }
          />
        </div>
        {serverError && (
          <div ref={alertRef}>
            <Alert tone="danger" title={t("notSent")}>{serverError}</Alert>
          </div>
        )}
        <div className="form-actions">
          <p className="pub-form__legal">{t("legal")}</p>
          <Button type="submit" variant="accent" size="lg" icon={Send} loading={submitting}>{t("submit")}</Button>
        </div>
      </form>
    </Card>
  );
}
