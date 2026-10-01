"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Alert, Button, Modal } from "../../../components/ui";
import { toast } from "../../../utils/alerts";

// Mot de passe provisoire renvoye quand l'email n'a pas pu partir (SMTP absent) : affiche une seule fois.
export default function TempPasswordModal({ credentials, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!credentials) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopied(true);
      toast("Mot de passe copié");
    } catch {
      toast("Copie impossible : sélectionnez le mot de passe manuellement", "warning");
    }
  };

  return (
    <Modal
      open
      title="Compte créé : identifiants provisoires"
      onClose={onClose}
      footer={<Button onClick={onClose}>J&apos;ai transmis le mot de passe</Button>}
    >
      <div className="stack">
        <Alert tone="warning" title="À noter maintenant : il ne sera plus affiché">
          L&apos;email d&apos;identifiants n&apos;a pas pu être envoyé (serveur d&apos;emails non configuré).
          Transmettez ce mot de passe par un canal sûr ; il devra être changé à la première connexion.
        </Alert>
        <dl className="dl">
          <dt>Nom</dt>
          <dd>{credentials.name}</dd>
          <dt>Email de connexion</dt>
          <dd>{credentials.email}</dd>
        </dl>
        <div className="adm-secret">
          <code aria-label="Mot de passe provisoire">{credentials.password}</code>
          <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>
            {copied ? "Copié" : "Copier"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
