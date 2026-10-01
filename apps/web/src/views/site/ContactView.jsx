"use client";

import "../../styles/public.css";
import { useState } from "react";
import { CheckCircle2, Heart, Mail, MapPin, Phone, Send, UsersRound } from "lucide-react";
import { Alert, Button, Card, Input, Textarea } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useMeta } from "../../hooks/useMeta";
import { publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { PublicHero } from "./components";

const MIN_MESSAGE = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = "Indiquez votre nom.";
  if (!EMAIL_RE.test(form.email.trim())) errors.email = "Adresse email invalide.";
  if (form.subject.trim().length < 3) errors.subject = "Précisez l’objet de votre message (3 caractères minimum).";
  if (form.content.trim().length < MIN_MESSAGE) errors.content = `Votre message doit contenir au moins ${MIN_MESSAGE} caractères.`;
  return errors;
}

export default function ContactView() {
  const { meta } = useMeta();
  const { user } = useAuth();
  const organization = meta.organization || {};
  const initial = () => ({ name: user?.name || "", email: user?.email || "", subject: "", content: "" });
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setServerError("");
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await publicApi.sendMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        content: form.content.trim(),
      });
      setSent(true);
      setForm(initial());
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PublicHero
        eyebrow="Contact"
        title="Parlons-en"
        lead="Une question sur nos projets, un partenariat, une demande de presse ? Écrivez-nous : notre équipe vous répond dans les meilleurs délais."
      />

      <section className="section section--tight">
        <div className="container pub-form-layout">
          <div className="stack" style={{ gap: 20 }}>
            <Card>
              <h2 className="pub-aside__title">Nos coordonnées</h2>
              <ul className="pub-contact-list">
                {organization.email && (
                  <li>
                    <span className="pub-feature__icon"><Mail aria-hidden="true" /></span>
                    <div><span>Email</span><a href={`mailto:${organization.email}`}>{organization.email}</a></div>
                  </li>
                )}
                {organization.phone && (
                  <li>
                    <span className="pub-feature__icon"><Phone aria-hidden="true" /></span>
                    <div><span>Téléphone</span><a href={`tel:${organization.phone.replace(/\s+/g, "")}`}>{organization.phone}</a></div>
                  </li>
                )}
                <li>
                  <span className="pub-feature__icon"><MapPin aria-hidden="true" /></span>
                  <div><span>Siège</span><strong>{organization.address || "Cameroun"}</strong></div>
                </li>
              </ul>
            </Card>
            <Card className="pub-mini-cta pub-mini-cta--accent">
              <h3>Vous souhaitez donner ?</h3>
              <p>Par carte ou Mobile Money, une fois ou chaque mois, pour le projet de votre choix.</p>
              <Button href="/don" variant="accent" size="sm" icon={Heart}>Faire un don</Button>
            </Card>
            <Card className="pub-mini-cta pub-mini-cta--brand">
              <h3>Vous souhaitez nous rejoindre ?</h3>
              <p>Bénévole, membre ou responsable : découvrez comment vous engager.</p>
              <Button href="/rejoindre" size="sm" icon={UsersRound}>Nous rejoindre</Button>
            </Card>
          </div>

          {sent ? (
            <Card className="pub-success" aria-live="polite">
              <span className="pub-success__icon"><CheckCircle2 size={30} aria-hidden="true" /></span>
              <h2>Message envoyé, merci !</h2>
              <p className="muted" style={{ margin: 0 }}>
                Nous avons bien reçu votre message. Un membre de l’équipe vous répondra par email dans les meilleurs délais.
              </p>
              <Button variant="secondary" onClick={() => setSent(false)}>Écrire un autre message</Button>
            </Card>
          ) : (
            <Card>
              <form className="pub-form" onSubmit={submit} noValidate>
                <div>
                  <h2 className="pub-form__title">Écrivez-nous</h2>
                  <p className="pub-form__intro">Tous les champs sont obligatoires.</p>
                </div>
                <div className="form-grid">
                  <Input label="Nom" required autoComplete="name" value={form.name} onChange={update("name")} error={errors.name} />
                  <Input label="Email" type="email" required autoComplete="email" value={form.email} onChange={update("email")} error={errors.email} />
                  <Input full label="Objet" required value={form.subject} onChange={update("subject")} error={errors.subject} />
                  <Textarea
                    full
                    label="Message"
                    required
                    rows={7}
                    value={form.content}
                    onChange={update("content")}
                    error={errors.content}
                    hint={`${form.content.trim().length} caractères (${MIN_MESSAGE} minimum)`}
                  />
                </div>
                {serverError && <Alert tone="danger" title="Message non envoyé">{serverError}</Alert>}
                <div className="form-actions">
                  <p className="pub-form__legal">Vos coordonnées ne servent qu’à vous répondre.</p>
                  <Button type="submit" size="lg" icon={Send} loading={submitting}>Envoyer le message</Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
