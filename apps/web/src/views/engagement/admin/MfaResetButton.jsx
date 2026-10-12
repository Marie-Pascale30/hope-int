"use client";

// Bouton de reinitialisation de la double authentification d'un compte (telephone perdu),
// a placer dans la fiche d'un membre (Administration > Membres), permission MANAGE_USER_ROLES.
// <MfaResetButton userId={member.id} name={member.name} onDone={reload} />
import { useState } from "react";
import { ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui";
import { useErrorMessage } from "../../../i18n/errors";
import { useAlerts } from "../../../utils/alerts";
import { mfaApi } from "../../../services/engagement";

export default function MfaResetButton({ userId, name, onDone }) {
  const t = useTranslations("engagement.mfa");
  const errorText = useErrorMessage();
  const { confirmAction, showError, toast } = useAlerts();
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    if (!(await confirmAction(t("adminReset"), `${name ? `${name} : ` : ""}${t("adminResetConfirm")}`, t("adminReset"), { danger: true }))) return;
    setBusy(true);
    try {
      await mfaApi.adminReset(userId);
      toast(t("adminResetDone"));
      onDone?.();
    } catch (err) {
      showError(t("error"), errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="ghost" icon={ShieldOff} loading={busy} onClick={reset}>
      {t("adminReset")}
    </Button>
  );
}
