"use client";

// Partage d'une page : feuille de partage native (application mobile, ou navigator.share quand le
// navigateur la propose), sinon WhatsApp (tres utilise au Cameroun), Facebook et copie du lien.
// path : chemin localise (useLocalePath / lp) ou URL absolue ; text : message d'accompagnement.
import { useEffect, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./ui";
import { toast } from "../utils/alerts";
import { isNativeApp, shareContent } from "../utils/native";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

const absolute = (origin, path) => (/^https?:\/\//.test(path) ? path : `${origin}${path}`);

// Suivi de la source des dons : ajoute ?ref=<source>-<canal> au lien partage (facultatif).
function withSource(url, source, channel) {
  if (!source) return url;
  const [base, hash] = url.split("#");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}ref=${encodeURIComponent(`${source}-${channel}`)}${hash ? `#${hash}` : ""}`;
}

function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...props}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c0-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...props}>
      <path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1a23 23 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4Z" />
    </svg>
  );
}

// source (facultatif) : prefixe de suivi ajoute au lien selon le canal (ex. "partage" ->
// ?ref=partage-whatsapp), conserve jusqu'au don par la page /don.
export default function ShareButtons({ path, title, text, label, source }) {
  const t = useTranslations("common.share");
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  // Origine publique (NEXT_PUBLIC_SITE_URL) au rendu serveur, celle du navigateur ensuite.
  const [origin, setOrigin] = useState(SITE_URL);

  useEffect(() => {
    // Detection apres le montage : le rendu serveur propose toujours les liens de repli.
    /* eslint-disable react-hooks/set-state-in-effect */
    setCanShare(isNativeApp() || (typeof navigator !== "undefined" && typeof navigator.share === "function"));
    setOrigin(window.location.origin);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const url = absolute(origin, path);
  const linkFor = (channel) => withSource(url, source, channel);
  const message = text ? `${text} ${linkFor("whatsapp")}` : linkFor("whatsapp");

  const nativeShare = async () => {
    try {
      await shareContent({ title, text, url: linkFor("natif") });
    } catch {
      // Partage annule : rien a signaler.
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(linkFor("lien"));
      setCopied(true);
      toast(t("copied"));
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast(t("copyFailed"), "error");
    }
  };

  return (
    <div className="share" role="group" aria-label={label ?? t("label")}>
      {canShare ? (
        <Button variant="secondary" size="sm" icon={Share2} onClick={nativeShare}>{t("share")}</Button>
      ) : (
        <>
          <a
            className="btn btn--secondary btn--sm share__whatsapp"
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon aria-hidden="true" /> {t("whatsapp")}
            <span className="visually-hidden"> {t("newWindow")}</span>
          </a>
          <a
            className="btn btn--secondary btn--sm share__facebook"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(linkFor("facebook"))}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FacebookIcon aria-hidden="true" /> {t("facebook")}
            <span className="visually-hidden"> {t("newWindow")}</span>
          </a>
          <Button variant="ghost" size="sm" icon={copied ? Check : Link2} onClick={copy}>
            {copied ? t("copiedShort") : t("copy")}
          </Button>
        </>
      )}
    </div>
  );
}
