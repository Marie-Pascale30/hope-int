"use client";

// Page hors ligne : precachee par le service worker (public/sw.js) et servie quand une page
// publique n'est ni joignable ni deja en cache. Bouton de nouvel essai et mode eco donnees.
import "@/src/styles/public.css";
import "@/src/styles/transparency.css";
import { useEffect, useState } from "react";
import { Home, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui";
import { OfflineIllustration } from "@/src/components/illustrations";
import { DataSaverToggle } from "@/src/components/eco/DataSaver";
import { useLocalePath } from "@/src/i18n/navigation";

export default function OfflineView() {
  const t = useTranslations("transparency.offline");
  const lp = useLocalePath();
  const [online, setOnline] = useState(null);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div className="container section">
      <div className="tp-empty offline">
        <OfflineIllustration />
        <h1>{t("title")}</h1>
        <p>{t("text")}</p>
        <p className="muted" role="status">{online === true ? t("backOnline") : online === false ? t("stillOffline") : ""}</p>
        <div className="row offline__actions">
          <Button icon={RefreshCw} onClick={() => window.location.reload()}>{t("retry")}</Button>
          <Button href={lp("/")} variant="secondary" icon={Home}>{t("home")}</Button>
        </div>
        <ul className="offline__tips">
          <li>{t("tipCached")}</li>
          <li>{t("tipEco")}</li>
        </ul>
        <DataSaverToggle />
      </div>
    </div>
  );
}
