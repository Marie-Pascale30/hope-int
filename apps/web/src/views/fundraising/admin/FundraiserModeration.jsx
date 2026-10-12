"use client";

// Moderation des collectes personnelles (MANAGE_CONTENT) : relecture de l'histoire, publication
// ou refus motive (l'organisateur est prevenu par email).
import "../../../styles/fundraising.css";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, X } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Modal, PageHeader, PageSkeleton, ProgressBar, Select, Textarea } from "../../../components/ui";
import RequireAuth from "../../../components/RequireAuth";
import { useAsync } from "../../../hooks/useAsync";
import { fundraisingAdminApi } from "../../../services/fundraising";
import { useFormat } from "../../../i18n/format";
import { useErrorMessage } from "../../../i18n/errors";
import { useAlerts } from "../../../utils/alerts";
import { localizePath } from "../../../i18n/config";
import { PERMISSIONS as P } from "../../../utils/rbac";
import { FUNDRAISER_STATUSES } from "@hope/shared/fundraising";
import { fundraiserPercent } from "../helpers";

const STATUS_TONES = { pending: "warning", published: "success", rejected: "danger", closed: "info" };

function ModerationView() {
  const t = useTranslations("fundraising.admin.fundraisers");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { showError, toast } = useAlerts();
  const [status, setStatus] = useState("pending");
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(() => fundraisingAdminApi.fundraisers(status ? { status } : {}), [status]);

  const decide = async (fundraiser, decision, message) => {
    setBusy(true);
    try {
      await fundraisingAdminApi.moderateFundraiser(fundraiser.id, decision, message);
      toast(decision === "approve" ? t("approved") : t("rejected"));
      setRejecting(null);
      setNote("");
      reload();
    } catch (err) {
      showError(t("errorTitle"), errorText(err));
    } finally {
      setBusy(false);
    }
  };

  let content;
  if (error) content = <ErrorState message={errorText(error)} onRetry={reload} />;
  else if (loading && !data) content = <PageSkeleton />;
  else if (!data?.length) content = <EmptyState title={t("emptyTitle")} description={t("emptyText")} />;
  else {
    content = (
      <div className="fr-list">
        {data.map((fundraiser) => (
          <Card key={fundraiser.id} className="fr-item">
            <div className="fr-item__head">
              <h2 className="fr-item__title">{fundraiser.title}</h2>
              <Badge tone={STATUS_TONES[fundraiser.status]}>{t(`statuses.${fundraiser.status}`)}</Badge>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {t("meta", {
                organizer: fundraiser.organizer_name || "—",
                project: fundraiser.project_title || "—",
                date: f.date(fundraiser.created_at),
              })}
            </p>
            <p style={{ margin: 0 }}>
              {t("goal", {
                raised: f.money(fundraiser.raised, fundraiser.currency),
                goal: f.money(fundraiser.goal_amount, fundraiser.currency),
                end: fundraiser.ends_on ? f.date(fundraiser.ends_on) : t("noEnd"),
              })}
            </p>
            {fundraiser.status !== "pending" && <ProgressBar value={fundraiserPercent(fundraiser)} accent />}
            <details>
              <summary>{t("story")}</summary>
              <p className="fr-page__story">{fundraiser.story}</p>
            </details>
            {fundraiser.moderation_note && <Alert tone="info" title={t("noteTitle")}>{fundraiser.moderation_note}</Alert>}
            <div className="fr-item__actions">
              {fundraiser.status === "pending" && (
                <>
                  <Button size="sm" icon={Check} loading={busy} onClick={() => decide(fundraiser, "approve")}>{t("approve")}</Button>
                  <Button size="sm" variant="ghost" icon={X} onClick={() => setRejecting(fundraiser)}>{t("reject")}</Button>
                </>
              )}
              {["published", "closed"].includes(fundraiser.status) && (
                <Button size="sm" variant="ghost" icon={ExternalLink} href={localizePath("fr", `/collecte/${fundraiser.slug}`)} target="_blank" rel="noopener noreferrer">
                  {t("view")}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <div className="panel">
        <Select
          label={t("filter")}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          placeholder={t("allStatuses")}
          options={FUNDRAISER_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) }))}
        />
        {content}
      </div>
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={t("rejectTitle")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>{t("cancel")}</Button>
            <Button variant="danger" loading={busy} onClick={() => decide(rejecting, "reject", note.trim())}>{t("reject")}</Button>
          </>
        }
      >
        <Textarea label={t("rejectNote")} rows={4} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} hint={t("rejectHint")} />
      </Modal>
    </>
  );
}

export default function FundraiserModeration() {
  return (
    <RequireAuth permission={P.MANAGE_CONTENT}>
      <ModerationView />
    </RequireAuth>
  );
}
