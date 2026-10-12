"use client";

// Verification publique d'une attestation de benevolat : authenticite, nom, periode et heures
// (l'API ne renvoie aucune autre donnee personnelle).
import { useState } from "react";
import { BadgeCheck, SearchCheck, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";
import { normalizeCertificateCode } from "@hope/shared/volunteering";
import { Alert, Button, Card, Input, LoadingState } from "@/src/components/ui";
import { useAsync } from "@/src/hooks/useAsync";
import { useFormat } from "@/src/i18n/format";
import { useRouter } from "@/src/i18n/navigation";
import { volunteeringApi } from "@/src/services/volunteering";
import "./volunteering.css";

function Result({ code }) {
  const t = useTranslations("volunteering.verify");
  const f = useFormat();
  const { data, loading, error } = useAsync(() => volunteeringApi.verifyCertificate(code), [code]);

  if (loading) return <LoadingState label={t("checking")} />;
  if (error || !data?.valid) {
    const notFound = error?.response?.status === 404;
    return (
      <Alert tone="danger" title={notFound ? t("invalid") : t("errorTitle")}>
        {notFound ? t("invalidText", { code }) : t("errorText")}
      </Alert>
    );
  }
  return (
    <Card>
      <div className="row" style={{ gap: 10 }}>
        <BadgeCheck aria-hidden="true" color="var(--success)" />
        <h2 style={{ margin: 0 }}>{t("valid")}</h2>
      </div>
      <p className="muted">{t("validText")}</p>
      <dl>
        <dt>{t("holder")}</dt>
        <dd>{data.holder_name}</dd>
        <dt>{t("period")}</dt>
        <dd>{t("periodValue", { from: f.date(data.period_start), to: f.date(data.period_end) })}</dd>
        <dt>{t("hours")}</dt>
        <dd>{t("hoursValue", { hours: f.number(data.total_hours, { maximumFractionDigits: 2 }) })}</dd>
        <dt>{t("issued")}</dt>
        <dd>{f.date(data.issued_at)}</dd>
        <dt>{t("code")}</dt>
        <dd><code>{data.code}</code></dd>
      </dl>
    </Card>
  );
}

export default function CertificateVerifyView({ code: initialCode = "" }) {
  const t = useTranslations("volunteering.verify");
  const router = useRouter();
  const code = normalizeCertificateCode(initialCode);
  const [value, setValue] = useState(code || initialCode || "");
  const [formError, setFormError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const normalized = normalizeCertificateCode(value);
    if (!normalized) {
      setFormError(t("format"));
      return;
    }
    setFormError("");
    router.push(`/attestation/${normalized}`);
  };

  return (
    <section className="section">
      <div className="container vol-verify stack">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p className="muted">{t("intro")}</p>
        </div>
        <form className="vol-verify__form" onSubmit={submit} noValidate>
          <Input
            label={t("codeLabel")}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="HOPE-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            error={formError || undefined}
          />
          <Button type="submit" icon={SearchCheck}>{t("submit")}</Button>
        </form>
        {code ? (
          <Result code={code} />
        ) : initialCode ? (
          <Alert tone="danger" title={t("invalid")}>
            <ShieldX aria-hidden="true" size={16} /> {t("format")}
          </Alert>
        ) : null}
      </div>
    </section>
  );
}
