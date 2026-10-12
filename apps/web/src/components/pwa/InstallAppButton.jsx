"use client";

// Bouton "Installer l'application" (menu mobile) : fenetre native sur Android,
// marche a suivre sur iPhone / iPad. Masque si l'application est deja installee.
import { useId, useState } from "react";
import { Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "../ui";
import { promptInstall, useInstallMode } from "./installPrompt";

export default function InstallAppButton({ className = "" }) {
  const t = useTranslations("pwa");
  const mode = useInstallMode();
  const [showHint, setShowHint] = useState(false);
  const hintId = useId();

  if (!mode) return null;

  if (mode === "native") {
    return (
      <Button variant="secondary" block icon={Download} className={className} onClick={promptInstall}>
        {t("install")}
      </Button>
    );
  }

  return (
    <div className={`install-app ${className}`.trim()}>
      <Button
        variant="secondary"
        block
        icon={Download}
        aria-expanded={showHint}
        aria-controls={hintId}
        onClick={() => setShowHint((value) => !value)}
      >
        {t("install")}
      </Button>
      <p id={hintId} className="install-app__hint" hidden={!showHint}>
        {t.rich("iosHint", {
          share: (chunks) => (
            <strong key="share">
              <Share size={15} aria-hidden="true" /> {chunks}
            </strong>
          ),
          add: (chunks) => <strong key="add">{chunks}</strong>,
        })}
      </p>
    </div>
  );
}
