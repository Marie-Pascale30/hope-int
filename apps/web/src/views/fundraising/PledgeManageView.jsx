"use client";

// Gestion d'un engagement Mobile Money sans compte, par le lien secret recu par email.
import "../../styles/account.css";
import "../../styles/fundraising.css";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, ErrorState, LoadingState } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { fundraisingApi } from "../../services/fundraising";
import { useErrorMessage } from "../../i18n/errors";
import PledgeCard from "./components/PledgeCard";

const TOKEN_PATTERN = /^[a-f0-9]{48}$/;

export default function PledgeManageView({ token }) {
  const t = useTranslations("fundraising.pledgeManage");
  const errorText = useErrorMessage();
  const params = useSearchParams();
  const valid = TOKEN_PATTERN.test(String(token || ""));
  const { data, loading, error, reload, setData } = useAsync(() => fundraisingApi.pledgeByToken(token), [token], { enabled: valid });

  let content;
  if (!valid || error?.response?.status === 404) {
    content = <ErrorState title={t("invalidTitle")} message={t("invalidText")} />;
  } else if (loading && !data) {
    content = <LoadingState />;
  } else if (error) {
    content = <ErrorState message={errorText(error)} onRetry={reload} />;
  } else {
    content = (
      <>
        {params.get("nouveau") === "1" && <Alert tone="success" title={t("createdTitle")}>{t("createdText")}</Alert>}
        <PledgeCard pledge={data} onUpdate={async (changes) => setData(await fundraisingApi.updatePledgeByToken(token, changes))} />
        <p className="muted fr-note">{t("keepLink")}</p>
      </>
    );
  }

  return (
    <div className="container fr-wrap">
      <span className="eyebrow">{t("eyebrow")}</span>
      <h1>{t("title")}</h1>
      <div className="fr-list">{content}</div>
    </div>
  );
}
