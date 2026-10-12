"use client";

// Espace membre : engagements de don mensuel Mobile Money (creer, modifier, suspendre, arreter).
// Onglet a integrer dans AccountView (voir le rapport d'integration).
import "@/src/styles/fundraising.css";
import { CalendarHeart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, LoadingState } from "@/src/components/ui";
import { useAsync } from "@/src/hooks/useAsync";
import { useLocalePath } from "@/src/i18n/navigation";
import { useErrorMessage } from "@/src/i18n/errors";
import { fundraisingApi } from "@/src/services/fundraising";
import PledgeCard from "@/src/views/fundraising/components/PledgeCard";

export default function PledgesPanel() {
  const t = useTranslations("fundraising.account.pledges");
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const { data, loading, error, reload, setData } = useAsync(() => fundraisingApi.myPledges(), []);

  const update = async (id, changes) => {
    const updated = await fundraisingApi.updatePledge(id, changes);
    setData((current) => (current || []).map((pledge) => (pledge.id === id ? updated : pledge)));
  };

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={errorText(error)} onRetry={reload} />;

  return (
    <section aria-labelledby="fr-pledges-title" className="fr-list">
      <div className="fr-item__head">
        <div>
          <h2 id="fr-pledges-title" className="fr-item__title">{t("title")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("description")}</p>
        </div>
        <Button href={lp("/collecte/engagement")} variant="secondary" size="sm" icon={CalendarHeart}>{t("create")}</Button>
      </div>
      {data?.length ? (
        data.map((pledge) => <PledgeCard key={pledge.id} pledge={pledge} onUpdate={(changes) => update(pledge.id, changes)} />)
      ) : (
        <EmptyState icon={CalendarHeart} title={t("emptyTitle")} description={t("emptyText")} />
      )}
    </section>
  );
}
