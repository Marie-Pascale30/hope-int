"use client";

// File « À valider » : contenus soumis (projets, actualites, temoignages), apercu, approbation
// (qui publie) ou refus commente. Reserve a APPROVE_CONTENT (portee non regionale : l'API controle).
import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Eye, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Alert, Badge, Button, DataTable, EmptyState, ErrorState, Modal, PageHeader, PageSkeleton, Switch, TabPanel, Tabs, Textarea,
} from "@/src/components/ui";
import RequireAuth from "@/src/components/RequireAuth";
import { useAsync } from "@/src/hooks/useAsync";
import { useFormat } from "@/src/i18n/format";
import { useErrorMessage } from "@/src/i18n/errors";
import { contentReviewApi } from "@/src/services/volunteering";
import { useAlerts } from "@/src/utils/alerts";
import { resolveImage, truncate } from "@/src/utils/format";
import { PERMISSIONS as P } from "@/src/utils/rbac";
import "./volunteering.css";

const STATUS_TABS = ["submitted", "approved", "rejected"];

function ReviewModal({ entry, onClose, onDone }) {
  const t = useTranslations("volunteering.review");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { showError, toast } = useAlerts();
  const { data, loading, error, reload } = useAsync(() => contentReviewApi.item(entry.type, entry.id), [entry.type, entry.id]);
  const [comment, setComment] = useState("");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(null);
  const [commentError, setCommentError] = useState("");

  const decide = async (decision) => {
    if (decision === "reject" && comment.trim().length < 3) {
      setCommentError(t("commentRequired"));
      return;
    }
    setBusy(decision);
    try {
      if (decision === "reject") await contentReviewApi.reject(entry.type, entry.id, comment.trim());
      else await contentReviewApi.approve(entry.type, entry.id, { comment: comment.trim(), publish });
      toast(decision === "reject" ? t("rejected") : publish ? t("approvedPublished") : t("approved"));
      onDone();
    } catch (err) {
      showError(t("failed"), errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const item = data?.item;
  const body = item ? item.description || item.content || "" : "";
  const pending = item && ["submitted", "approved"].includes(item.review_status);

  return (
    <Modal
      open
      large
      title={t("previewTitle", { name: entry.title })}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("close")}</Button>
          {pending && (
            <>
              <Button variant="secondary" icon={XCircle} loading={busy === "reject"} disabled={Boolean(busy)} onClick={() => decide("reject")}>
                {t("reject")}
              </Button>
              <Button icon={CheckCircle2} loading={busy === "approve"} disabled={Boolean(busy)} onClick={() => decide("approve")}>
                {publish ? t("approvePublish") : t("approve")}
              </Button>
            </>
          )}
        </>
      }
    >
      {error ? (
        <ErrorState message={errorText(error)} onRetry={reload} />
      ) : loading || !item ? (
        <PageSkeleton variant="list" rows={2} label={t("loading")} />
      ) : (
        <div className="stack">
          <p className="muted">
            {t(`types.${entry.type}`)}
            {data.submitted_by_name ? ` · ${t("submittedBy", { name: data.submitted_by_name })}` : ""}
            {item.submitted_at ? ` · ${f.dateTime(item.submitted_at)}` : ""}
          </p>
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveImage(item.image_url)} alt={item.image_alt || ""} style={{ maxWidth: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8 }} />
          )}
          {item.summary && <p><strong>{item.summary}</strong></p>}
          {item.role_label && <p className="muted">{item.role_label}</p>}
          <div className="vol-review-preview">{body}</div>
          {item.review_comment && (
            <Alert tone="warning" title={t("lastComment")}>{item.review_comment}</Alert>
          )}
          {pending && (
            <>
              <Textarea
                label={t("comment")}
                hint={t("commentHint")}
                rows={3}
                maxLength={2000}
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  setCommentError("");
                }}
                error={commentError || undefined}
              />
              <Switch label={publish ? t("publishOn") : t("publishOff")} checked={publish} onChange={setPublish} />
            </>
          )}
          {data.history.length > 0 && (
            <div>
              <h3 className="adm-form-section">{t("history")}</h3>
              <ul className="stack" style={{ gap: 6, paddingLeft: 18 }}>
                {data.history.map((row) => (
                  <li key={row.id}>
                    <strong>{t(`actions.${row.action}`)}</strong>
                    {" · "}
                    {row.actor_name || "—"}
                    {" · "}
                    {f.dateTime(row.created_at)}
                    {row.comment ? ` — ${row.comment}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ReviewQueueView() {
  const t = useTranslations("volunteering.review");
  const f = useFormat();
  const errorText = useErrorMessage();
  const [status, setStatus] = useState("submitted");
  const { data, loading, error, reload } = useAsync(() => contentReviewApi.queue(status), [status]);
  const [open, setOpen] = useState(null);
  const rows = (data || []).map((row) => ({ ...row, key: `${row.type}-${row.id}` }));

  const columns = [
    {
      key: "title",
      header: t("columns.content"),
      sortable: true,
      render: (row) => (
        <div className="cell-main">
          <strong>{row.title}</strong>
          <span>{truncate(row.summary || row.body || "", 90)}</span>
        </div>
      ),
    },
    { key: "type", header: t("columns.type"), sortable: true, render: (row) => <Badge>{t(`types.${row.type}`)}</Badge> },
    { key: "region", header: t("columns.region"), sortable: true, render: (row) => row.region || "—" },
    { key: "submitted_by_name", header: t("columns.author"), sortable: true, render: (row) => row.submitted_by_name || "—" },
    {
      key: "submitted_at",
      header: t("columns.submittedAt"),
      sortable: true,
      render: (row) => <span className="adm-nowrap">{f.dateTime(row.submitted_at || row.created_at)}</span>,
    },
    {
      key: "actions",
      label: t("columns.actions"),
      header: <span className="visually-hidden">{t("columns.actions")}</span>,
      render: (row) => (
        <Button size="sm" variant="secondary" icon={Eye} onClick={() => setOpen(row)} aria-label={t("openNamed", { name: row.title })}>
          {t("open")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <Tabs
        id="review-tabs"
        tabs={STATUS_TABS.map((value) => ({ value, label: t(`tabs.${value}`) }))}
        value={status}
        onChange={setStatus}
        label={t("tabs.label")}
      />
      <TabPanel tabsId="review-tabs" value={status}>
        {error ? (
          <ErrorState message={errorText(error)} onRetry={reload} />
        ) : loading && !data ? (
          <PageSkeleton variant="table" columns={5} label={t("loading")} />
        ) : rows.length === 0 ? (
          <div className="panel">
            <EmptyState icon={ClipboardCheck} title={t(`empty.${status}`)} description={t("emptyText")} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows.map((row) => ({ ...row, id: row.key }))}
            searchKeys={(row) => `${row.title} ${row.summary || ""} ${row.region || ""} ${row.submitted_by_name || ""}`}
            searchPlaceholder={t("search")}
          />
        )}
      </TabPanel>
      {open && (
        <ReviewModal
          entry={{ type: open.type, id: Number(String(open.key).split("-")[1]), title: open.title }}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            reload();
          }}
        />
      )}
    </>
  );
}

export default function ReviewQueue() {
  return (
    <RequireAuth permission={P.APPROVE_CONTENT}>
      <ReviewQueueView />
    </RequireAuth>
  );
}
