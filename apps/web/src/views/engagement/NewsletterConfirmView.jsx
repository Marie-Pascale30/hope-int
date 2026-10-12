"use client";

// Page /newsletter/confirmer?token=... : seconde etape du double opt-in.
import "./engagement.css";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, Button, LoadingState } from "../../components/ui";
import { useLocalePath } from "../../i18n/navigation";
import { preferencesApi } from "../../services/engagement";

export default function NewsletterConfirmView() {
  const t = useTranslations("engagement.newsletterConfirm");
  const lp = useLocalePath();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState(token ? "loading" : "error");
  const [email, setEmail] = useState("");
  const started = useRef(false);

  useEffect(() => {
    // Une seule confirmation, meme en double rendu (mode strict).
    if (!token || started.current) return;
    started.current = true;
    preferencesApi.confirmNewsletter(token)
      .then((result) => {
        setEmail(result.email);
        setState("done");
      })
      .catch(() => setState("error"));
  }, [token]);

  return (
    <section className="eng-page stack" aria-live="polite">
      <h1>{t("title")}</h1>
      {state === "loading" && <LoadingState label={t("confirming")} />}
      {state === "done" && <Alert tone="success" title={t("successTitle")}>{t("successText", { email })}</Alert>}
      {state === "error" && <Alert tone="warning" title={t("errorTitle")}>{t("errorText")}</Alert>}
      {state !== "loading" && <p><Button href={lp("/")} variant="secondary">{t("home")}</Button></p>}
    </section>
  );
}
