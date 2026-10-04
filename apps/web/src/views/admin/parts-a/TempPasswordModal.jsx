"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Button, Modal } from "../../../components/ui";
import { toast } from "../../../utils/alerts";

// Mot de passe provisoire renvoye quand l'email n'a pas pu partir (SMTP absent) : affiche une seule fois.
export default function TempPasswordModal({ credentials, onClose }) {
  const t = useTranslations("admin.tempPassword");
  const [copied, setCopied] = useState(false);
  if (!credentials) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopied(true);
      toast(t("copiedToast"));
    } catch {
      toast(t("copyFailed"), "warning");
    }
  };

  return (
    <Modal
      open
      title={t("title")}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t("done")}</Button>}
    >
      <div className="stack">
        <Alert tone="warning" title={t("alertTitle")}>
          {t("alertText")}
        </Alert>
        <dl className="dl">
          <dt>{t("name")}</dt>
          <dd>{credentials.name}</dd>
          <dt>{t("loginEmail")}</dt>
          <dd>{credentials.email}</dd>
        </dl>
        <div className="adm-secret">
          <code aria-label={t("passwordLabel")}>{credentials.password}</code>
          <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
