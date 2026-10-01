"use client";

import "../../styles/public.css";
import { useRef, useState } from "react";
import { BadgeCheck, CheckCircle2, HandHeart, Send, Sparkles, UsersRound } from "lucide-react";
import { Alert, Button, Card, ChoiceGroup, Input, Select, Textarea } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { regionOptions, useMeta } from "../../hooks/useMeta";
import { publicApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { PublicHero } from "./components";

const MIN_MOTIVATION = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY = { name: "", email: "", phone: "", region: "", motivation: "" };

const WAYS = [
  {
    icon: HandHeart,
    title: "Bénévole",
    text: "Donnez quelques heures : accueil lors des collectes, appui aux ateliers, logistique, communication.",
  },
  {
    icon: UsersRound,
    title: "Membre",
    text: "Adhérez à l’association, participez à l’assemblée générale et aux décisions, accédez à votre espace membre.",
    accent: true,
  },
  {
    icon: Sparkles,
    title: "Rôles de responsabilité",
    text: "Direction, finances, ressources humaines, pôle IT, coordination régionale : mettez vos compétences au service du projet.",
  },
];

function validate(form, roles) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = "Indiquez votre nom complet.";
  if (!EMAIL_RE.test(form.email.trim())) errors.email = "Adresse email invalide.";
  if (roles.length === 0) errors.roles = "Choisissez au moins un rôle.";
  if (form.motivation.trim().length < MIN_MOTIVATION) {
    errors.motivation = `Votre message doit contenir au moins ${MIN_MOTIVATION} caractères.`;
  }
  return errors;
}

function Confirmation({ email, onReset }) {
  return (
    <Card className="pub-success" aria-live="polite">
      <span className="pub-success__icon"><CheckCircle2 size={30} aria-hidden="true" /></span>
      <h2>Merci, votre candidature est bien arrivée !</h2>
      <p className="muted" style={{ margin: 0 }}>Voici comment se passe la suite :</p>
      <ol className="pub-steps">
        <li><strong>Étude de votre candidature</strong><span>Notre équipe des ressources humaines lit chaque demande avec attention.</span></li>
        <li><strong>Réponse par email</strong><span>Vous recevrez notre réponse à l’adresse {email}, en général sous quelques jours.</span></li>
        <li><strong>Vos identifiants</strong><span>Si votre candidature est acceptée, un compte est créé et vos identifiants de connexion vous sont envoyés.</span></li>
      </ol>
      <div className="row">
        <Button href="/">Retour à l’accueil</Button>
        <Button variant="secondary" onClick={onReset}>Envoyer une autre candidature</Button>
      </div>
    </Card>
  );
}

export default function JoinView() {
  const { meta } = useMeta();
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [roles, setRoles] = useState(["membre"]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const alertRef = useRef(null);

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const roleOptions = meta.applicationRoles?.length ? meta.applicationRoles : [{ value: "membre", label: "Membre" }];
  const motivationLength = form.motivation.trim().length;

  const submit = async (event) => {
    event.preventDefault();
    setServerError("");
    const found = validate(form, roles);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await publicApi.sendApplication({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        region: form.region || undefined,
        desiredRoles: roles,
        motivation: form.motivation.trim(),
      });
      setSentTo(form.email.trim());
      setForm(EMPTY);
      setRoles(["membre"]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const status = err?.response?.status;
      setServerError(
        status === 409
          ? `${getErrorMessage(err)} Si vous avez déjà un compte, connectez-vous à votre espace ; sinon, patientez : votre candidature précédente est en cours d’étude.`
          : getErrorMessage(err)
      );
      requestAnimationFrame(() => alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PublicHero
        eyebrow="Nous rejoindre"
        title="Engagez-vous à nos côtés"
        lead="Bénévoles, membres, professionnels : chacun peut contribuer à l’autonomie des familles camerounaises, selon son temps et ses compétences."
      />

      <section className="section section--tight">
        <div className="container">
          <div className="grid grid--3">
            {WAYS.map(({ icon: Icon, title, text, accent }) => (
              <Card key={title} className={`pub-feature${accent ? " pub-feature--accent" : ""}`}>
                <span className="pub-feature__icon"><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--alt" aria-labelledby="join-form-title">
        <div className="container pub-form-layout">
          <div>
            <span className="eyebrow">Candidature</span>
            <h2 id="join-form-title">Comment ça se passe ?</h2>
            <ol className="pub-steps">
              <li><strong>Vous remplissez le formulaire</strong><span>Présentez-vous et indiquez les rôles qui vous intéressent.</span></li>
              <li><strong>Nous étudions votre demande</strong><span>Un membre de l’équipe RH peut vous contacter pour échanger.</span></li>
              <li><strong>Vous recevez vos identifiants</strong><span>En cas d’accord, votre compte est créé et vous accédez à votre espace membre.</span></li>
            </ol>
            <p className="muted" style={{ marginTop: 20 }}>
              <BadgeCheck size={18} aria-hidden="true" style={{ display: "inline", verticalAlign: "-3px", marginRight: 6, color: "var(--brand)" }} />
              Vos données servent uniquement au traitement de votre candidature.
            </p>
          </div>

          {sentTo ? (
            <Confirmation email={sentTo} onReset={() => setSentTo("")} />
          ) : (
            <Card>
              <form className="pub-form" onSubmit={submit} noValidate>
                <div>
                  <h3 className="pub-form__title">Votre candidature</h3>
                  <p className="pub-form__intro">Les champs marqués d’un astérisque sont obligatoires.</p>
                </div>
                {isAuthenticated && (
                  <Alert tone="info">
                    Vous êtes déjà connecté(e) : si vous souhaitez un nouveau rôle, contactez plutôt l’équipe via la page Contact.
                  </Alert>
                )}
                <div className="form-grid">
                  <Input label="Nom complet" required autoComplete="name" value={form.name} onChange={update("name")} error={errors.name} />
                  <Input label="Email" type="email" required autoComplete="email" value={form.email} onChange={update("email")} error={errors.email} />
                  <Input label="Téléphone" type="tel" autoComplete="tel" placeholder="+237 6XX XX XX XX" value={form.phone} onChange={update("phone")} />
                  <Select label="Région" options={regionOptions(meta)} placeholder="Choisir une région" value={form.region} onChange={update("region")} />
                  <ChoiceGroup
                    full
                    label="Rôles souhaités"
                    hint="Plusieurs choix possibles."
                    options={roleOptions}
                    value={roles}
                    onChange={(next) => {
                      setRoles(next);
                      if (errors.roles) setErrors((prev) => ({ ...prev, roles: undefined }));
                    }}
                    error={errors.roles}
                  />
                  <Textarea
                    full
                    label="Votre motivation"
                    required
                    rows={6}
                    placeholder="Parlez-nous de vous, de votre expérience et de ce qui vous donne envie de nous rejoindre."
                    value={form.motivation}
                    onChange={update("motivation")}
                    error={errors.motivation}
                    hint={
                      <span className={`pub-counter${motivationLength >= MIN_MOTIVATION ? " pub-counter--ok" : ""}`}>
                        {motivationLength} / {MIN_MOTIVATION} caractères minimum
                      </span>
                    }
                  />
                </div>
                {serverError && (
                  <div ref={alertRef}>
                    <Alert tone="danger" title="Candidature non envoyée">{serverError}</Alert>
                  </div>
                )}
                <div className="form-actions">
                  <p className="pub-form__legal">En envoyant ce formulaire, vous acceptez d’être recontacté(e) par HOPE International.</p>
                  <Button type="submit" variant="accent" size="lg" icon={Send} loading={submitting}>Envoyer ma candidature</Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
