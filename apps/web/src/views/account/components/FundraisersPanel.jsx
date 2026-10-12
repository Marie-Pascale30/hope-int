"use client";

// Espace membre : collectes personnelles de l'organisateur (statut de moderation, jauge, partage,
// modification avant publication, cloture). Onglet a integrer dans AccountView.
import "@/src/styles/fundraising.css";
import { Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, LoadingState, ProgressBar } from "@/src/components/ui";
import ShareButtons from "@/src/components/ShareButtons";
import { useAsync } from "@/src/hooks/useAsync";
import { useFormat } from "@/src/i18n/format";
import { useLocalePath } from "@/src/i18n/navigation";
import { useErrorMessage } from "@/src/i18n/errors";
import { fundraisingApi } from "@/src/services/fundraising";
import { useAlerts } from "@/src/utils/alerts";
import { fundraiserPercent } from "@/src/views/fundraising/helpers";
import { SOURCES } from "@hope/shared/fundraising";

const STATUS_TONES = { pending: "warning", published: "success", rejected: "danger", closed: "info" };

function FundraiserItem({ fundraiser, onChanged }) {
  const t = useTranslations("fundraising.account.fundraisers");
  const f = useFormat();
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const { confirmAction, showError, toast } = useAlerts();
  const percent = fundraiserPercent(fundraiser);

  const close = async () => {
    const ok = await confirmAction(t("closeTitle"), t("closeText"), t("closeConfirm"), { danger: true });
    if (!ok) return;
    try {
      onChanged(await fundraisingApi.updateFundraiser(fundraiser.id, { status: "closed" }));
      toast(t("closed"));
    } catch (err) {
      showError(t("closeTitle"), errorText(err));
    }
  };

  return (
    <Card className="fr-item">
      <div className="fr-item__head">
        <h3 className="fr-item__title">{fundraiser.title}</h3>
        <Badge tone={STATUS_TONES[fundraiser.status]}>{t(`status.${fundraiser.status}`)}</Badge>
      </div>
      <p className="muted" style={{ margin: 0 }}>{t("project", { project: fundraiser.project_title || "" })}</p>
      <p style={{ margin: 0 }}>
        {t("progress", {
          raised: f.money(fundraiser.raised, fundraiser.currency),
          goal: f.money(fundraiser.goal_amount, fundraiser.currency),
          count: fundraiser.supporters,
        })}
      </p>
      <ProgressBar value={percent} accent label={t("progressLabel", { percent })} />
      {fundraiser.status === "rejected" && fundraiser.moderation_note && (
        <Alert tone="warning" title={t("rejectedTitle")}>{fundraiser.moderation_note}</Alert>
      )}
      {fundraiser.status === "pending" && <p className="muted fr-note">{t("pendingNote")}</p>}
      <div className="fr-item__actions">
        {["published", "closed"].includes(fundraiser.status) && (
          <Button href={lp(`/collecte/${fundraiser.slug}`)} variant="secondary" size="sm">{t("view")}</Button>
        )}
        {["pending", "rejected"].includes(fundraiser.status) && (
          <Button href={lp(`/collecte/nouvelle?id=${fundraiser.id}`)} variant="secondary" size="sm">{t("edit")}</Button>
        )}
        {fundraiser.status === "published" && <Button variant="ghost" size="sm" onClick={close}>{t("close")}</Button>}
      </div>
      {fundraiser.status === "published" && (
        <ShareButtons
          path={lp(`/collecte/${fundraiser.slug}`)}
          title={fundraiser.title}
          text={t("shareText", { title: fundraiser.title })}
          source={SOURCES.shareNative}
        />
      )}
    </Card>
  );
}

export default function FundraisersPanel() {
  const t = useTranslations("fundraising.account.fundraisers");
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const { data, loading, error, reload, setData } = useAsync(() => fundraisingApi.myFundraisers(), []);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={errorText(error)} onRetry={reload} />;

  const replace = (updated) => setData((current) => (current || []).map((item) => (item.id === updated.id ? updated : item)));

  return (
    <section aria-labelledby="fr-fundraisers-title" className="fr-list">
      <div className="fr-item__head">
        <div>
          <h2 id="fr-fundraisers-title" className="fr-item__title">{t("title")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("description")}</p>
        </div>
        <Button href={lp("/collecte/nouvelle")} variant="secondary" size="sm" icon={Megaphone}>{t("create")}</Button>
      </div>
      {data?.length ? (
        data.map((fundraiser) => <FundraiserItem key={fundraiser.id} fundraiser={fundraiser} onChanged={replace} />)
      ) : (
        <EmptyState icon={Megaphone} title={t("emptyTitle")} description={t("emptyText")} />
      )}
    </section>
  );
}
